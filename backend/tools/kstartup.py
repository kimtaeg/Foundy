"""창업진흥원 K-Startup 사업공고(공공데이터포털)를 지원사업 판정 입력으로 바꾼다.

- fetch: 모집 중인 공고 목록을 가져온다 (실제 호출).
- select: 마감·지역·대상으로 코드가 먼저 거르고, 카페·음식점 창업과 관련된 정도로 순서를 매겨 몇 건만 남긴다.
  자격 판정은 하지 않는다 (공고문 조건 추출과 판정은 agent/grants.py 가 한다).
- notice: 공고 필드를 라벨을 붙인 공고문으로 합친다. AI 인용 검증은 이 원문에서 한다.
"""

from __future__ import annotations

import re
from datetime import date
from urllib.parse import unquote

from tools.failure import check_gateway

URL = "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01"
SOURCE = "K-Startup 사업공고"
PER_PAGE = 500
MAX_GRANTS = 12

# 주소의 시·도 이름 → 공고의 지원 지역 표기
SIDO = {
    "서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천", "광주": "광주", "대전": "대전", "울산": "울산",
    "세종": "세종", "경기": "경기", "강원": "강원", "충청북": "충북", "충북": "충북", "충청남": "충남", "충남": "충남",
    "전라북": "전북", "전북": "전북", "전라남": "전남", "전남": "전남", "경상북": "경북", "경북": "경북",
    "경상남": "경남", "경남": "경남", "제주": "제주",
}
# 개인 창업자가 신청할 수 있는 대상 표기 (대학·연구기관·청소년만 대상인 공고는 뺀다)
OPEN_TARGETS = ("일반인", "일반기업", "1인 창조기업")
SKIP_CATEGORIES = {"글로벌"}
# 카페·음식점 창업과 관련된 정도 (공고명·대상·내용에서 찾는다)
RELEVANCE = [
    (re.compile(r"소상공인"), 4), (re.compile(r"외식|음식|요식|카페|식품|주방|조리"), 4),
    (re.compile(r"점포|상가|상권|골목"), 3), (re.compile(r"예비\s*창업|초기\s*창업|창업\s*3년"), 2),
    (re.compile(r"청년"), 1), (re.compile(r"자금|융자|보증|임대료|임차"), 1),
]
UNRELATED = re.compile(r"딥테크|반도체|바이오|R&D|연구개발|기술사업화|수출|해외|글로벌|대학생|청소년|교원|실험실|투자유치|IR")


def sido_of(address: str) -> str | None:
    head = (address or "").strip()[:4]
    for key, short in SIDO.items():
        if head.startswith(key):
            return short
    return None


def _date(value: str | None) -> date | None:
    text = re.sub(r"\D", "", value or "")
    try:
        return date(int(text[:4]), int(text[4:6]), int(text[6:8])) if len(text) >= 8 else None
    except ValueError:
        return None


def fetch(client, service_key: str) -> list[dict]:
    """모집 중(rcrt_prgs_yn=Y)인 공고를 모두 가져온다. 통신·제공자 오류는 예외."""
    rows: list[dict] = []
    for page in range(1, 6):
        response = client.get(URL, params={
            "serviceKey": unquote(service_key), "page": page, "perPage": PER_PAGE, "returnType": "json",
            "cond[rcrt_prgs_yn::EQ]": "Y"})
        check_gateway(response, "KSTARTUP_GATEWAY_ERROR")
        response.raise_for_status()
        batch = response.json().get("data") or []
        rows.extend(batch)
        if len(batch) < PER_PAGE:
            return rows
    return rows


def notice(row: dict) -> str:
    """공고 필드를 공고문 하나로 합친다 (값이 있는 필드만)."""
    start, end = _date(row.get("pbanc_rcpt_bgng_dt")), _date(row.get("pbanc_rcpt_end_dt"))
    parts = [
        ("공고명", row.get("biz_pbanc_nm")), ("공고 기관", row.get("pbanc_ntrp_nm")),
        ("지원 분야", row.get("supt_biz_clsfc")), ("지원 지역", row.get("supt_regin")),
        ("신청 대상", row.get("aply_trgt")), ("대상 연령", row.get("biz_trgt_age")), ("업력", row.get("biz_enyy")),
        ("신청 자격", row.get("aply_trgt_ctnt")), ("제외 대상", row.get("aply_excl_trgt_ctnt")),
        ("지원 내용", row.get("support_ctnt")), ("공고 내용", row.get("pbanc_ctnt")),
        ("우대 사항", row.get("prfn_matr")),
        ("접수 기간", f"{start.isoformat()} ~ {end.isoformat()}" if start and end else None),
    ]
    return "\n".join(f"{label}: {str(value).strip()}" for label, value in parts if value and str(value).strip())


def _score(row: dict) -> int:
    text = " ".join(str(row.get(k) or "") for k in ("biz_pbanc_nm", "aply_trgt_ctnt", "pbanc_ctnt", "support_ctnt"))
    score = sum(weight for pattern, weight in RELEVANCE if pattern.search(text))
    if UNRELATED.search(str(row.get("biz_pbanc_nm") or "")):
        score -= 5
    return score


def select(rows: list[dict], address: str, today: date, limit: int = MAX_GRANTS) -> tuple[list[dict], dict]:
    """판정할 공고를 고른다. 두 번째 값은 거른 이유별 개수."""
    sido = sido_of(address)
    counts = {"closed": 0, "region": 0, "target": 0, "unrelated": 0}
    picked: list[tuple[int, date, dict]] = []
    seen: set[str] = set()
    for row in rows:
        sn = str(row.get("pbanc_sn") or "")
        if not sn or sn in seen:
            continue
        seen.add(sn)
        end = _date(row.get("pbanc_rcpt_end_dt"))
        if end is None or end < today:
            counts["closed"] += 1
            continue
        region = str(row.get("supt_regin") or "")
        if "전국" not in region and (sido is None or sido not in region):
            counts["region"] += 1
            continue
        targets = str(row.get("aply_trgt") or "")
        if targets and not any(t in targets for t in OPEN_TARGETS):
            counts["target"] += 1
            continue
        score = _score(row)
        if row.get("supt_biz_clsfc") in SKIP_CATEGORIES or score <= 0:
            counts["unrelated"] += 1
            continue
        picked.append((score, end, row))
    picked.sort(key=lambda x: (-x[0], x[1]))
    counts["unrelated"] += max(0, len(picked) - limit)
    return [_grant(row) for _, _, row in picked[:limit]], counts


def _grant(row: dict) -> dict:
    end = _date(row.get("pbanc_rcpt_end_dt"))
    org = str(row.get("pbanc_ntrp_nm") or "").strip()
    return {
        "grant_id": f"kstartup-{row.get('pbanc_sn')}",
        "title": str(row.get("biz_pbanc_nm") or "").strip(),
        "source": SOURCE,
        "org": org or None,
        "category": row.get("supt_biz_clsfc") or None,
        "region": row.get("supt_regin") or None,
        "url": row.get("detl_pg_url") or row.get("biz_gdnc_url") or None,
        "deadline": end.isoformat() if end else None,
        "text": notice(row),
    }
