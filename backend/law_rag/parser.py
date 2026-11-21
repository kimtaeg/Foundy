"""법제처 법령 본문 JSON(lawService.do) → 조문·별표 단위 레코드.

실제 응답과 mocks/law_body.json 같은 저장본이 같은 형태라서 같은 파서를 쓴다.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date

LAW_VIEW_URL = "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq={mst}"
LAW_NAME_URL = "https://www.law.go.kr/법령/{name}"


@dataclass
class ParsedArticle:
    kind: str                 # article | annex
    number: int
    branch: int
    label: str                # 제37조 · 제3조의2 · 별표 1
    title: str | None
    content: str
    effective_date: date | None
    content_hash: str = ""

    def __post_init__(self) -> None:
        self.content_hash = hashlib.sha256(self.content.encode("utf-8")).hexdigest()


@dataclass
class ParsedLaw:
    law_key: str              # 법령ID
    name: str
    law_type: str | None
    mst: str                  # 법령일련번호
    promulgation_no: str | None
    effective_date: date | None
    ministry: str | None
    source_url: str
    articles: list[ParsedArticle] = field(default_factory=list)

    @property
    def body_hash(self) -> str:
        digest = hashlib.sha256()
        for a in sorted(self.articles, key=lambda x: (x.kind, x.number, x.branch)):
            digest.update(f"{a.kind}:{a.number}:{a.branch}:{a.content_hash}".encode())
        return digest.hexdigest()


def _date(value) -> date | None:
    text = str(value or "").strip()
    return date(int(text[:4]), int(text[4:6]), int(text[6:8])) if re.fullmatch(r"\d{8}", text) else None


def _int(value, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _rows(value) -> list:
    return value if isinstance(value, list) else [value] if isinstance(value, dict) else []


def _text(value) -> list[str]:
    """항·호·목 등 중첩 구조에서 '…내용' 문자열만 순서대로 모은다 (번호 필드는 제외)."""
    out: list[str] = []
    if isinstance(value, str):
        if value.strip():
            out.append(value.strip())
    elif isinstance(value, list):
        for v in value:
            out += _text(v)
    elif isinstance(value, dict):
        for key, v in value.items():
            if key.endswith("내용") or key in {"항", "호", "목", "별표단위"}:
                out += _text(v)
    return out


def article_label(number: int, branch: int) -> str:
    return f"제{number}조의{branch}" if branch else f"제{number}조"


def annex_label(number: int, branch: int) -> str:
    return f"별표 {number}의{branch}" if branch else f"별표 {number}"


def parse_law(payload: dict, mst: str | None = None) -> ParsedLaw:
    """`{"법령": {...}}` 응답을 파싱한다. mst(법령일련번호)는 검색 결과에서 받은 값을 넘긴다."""
    body = payload["법령"] if "법령" in payload else payload
    info = body["기본정보"]
    name = info["법령명_한글"].strip()
    law_key = str(info.get("법령ID") or body.get("법령키", ""))[:6] or name
    effective = _date(info.get("시행일자"))
    mst_value = str(mst or body.get("법령키") or law_key)
    law = ParsedLaw(
        law_key=law_key, name=name,
        law_type=(info.get("법종구분") or {}).get("content") if isinstance(info.get("법종구분"), dict) else None,
        mst=mst_value, promulgation_no=str(info.get("공포번호") or "") or None, effective_date=effective,
        ministry=(info.get("소관부처") or {}).get("content") if isinstance(info.get("소관부처"), dict) else None,
        source_url=LAW_VIEW_URL.format(mst=mst) if mst else LAW_NAME_URL.format(name=name),
    )

    seen: set[tuple[str, int, int]] = set()
    for unit in _rows((body.get("조문") or {}).get("조문단위")):
        if unit.get("조문여부") != "조문":  # 장·절 제목(전문)은 건너뛴다
            continue
        number, branch = _int(unit.get("조문번호")), _int(unit.get("조문가지번호"))
        key = ("article", number, branch)
        text = "\n".join(_text(unit))
        if not number or not text or key in seen:
            continue
        seen.add(key)
        law.articles.append(ParsedArticle(
            "article", number, branch, article_label(number, branch), (unit.get("조문제목") or "").strip() or None,
            text, _date(unit.get("조문시행일자")) or effective))

    for unit in _rows((body.get("별표") or {}).get("별표단위")):
        if unit.get("별표구분") != "별표":  # 서식은 건너뛴다
            continue
        number, branch = _int(unit.get("별표번호")), _int(unit.get("별표가지번호"))
        key = ("annex", number, branch)
        lines = [ln.rstrip() for ln in _text(unit.get("별표내용"))]
        title = (unit.get("별표제목") or "").strip()
        if not number or not lines or title.startswith("삭제") or key in seen:
            continue
        seen.add(key)
        law.articles.append(ParsedArticle(
            "annex", number, branch, annex_label(number, branch), title or None, "\n".join(lines), effective))
    return law
