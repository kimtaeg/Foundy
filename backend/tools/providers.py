"""공식 조회 응답을 분석 계약으로 변환한다. 판정·법령 참조 결정은 하지 않는다."""

import re
import xml.etree.ElementTree as ET
from urllib.parse import unquote

import httpx

from agent.ports import ToolResult
from config import get_settings
from services.pack import get_pack
from services.timeutil import now_utc, today_kst
from rules import building_use
from tools import address as address_tool
from tools.failure import ProviderError, check_gateway
from tools import kstartup

KAKAO_URL = address_tool.KAKAO_URL
BUILDING_URL = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrFlrOulnInfo"
BUILDING_UNIT_URL = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo"
TRADEMARK_URL = "https://plus.kipris.or.kr/kipo-api/kipi/trademarkInfoSearchService/getAdvancedSearch"
LAW_BASE = "https://www.law.go.kr/DRF"


def _rows(value):
    return value if isinstance(value, list) else [value] if isinstance(value, dict) else []


class Providers:
    def __init__(self, client=None, settings=None, references=None):
        self.settings = settings or get_settings()
        self.client = client or httpx.Client(timeout=10, follow_redirects=False)
        self.references = references if references is not None else get_pack().get("law_references", {})
        self._law_versions: dict[tuple[str, str], tuple[str, str]] = {}
        self._law_articles: dict[tuple[str, str, str, str, int], dict] = {}

    def close(self):
        self.client.close()

    def _get(self, url, **kwargs):
        response = self.client.get(url, **kwargs)
        check_gateway(response, "DATA_GO_KR_GATEWAY_ERROR")
        response.raise_for_status()
        return response

    def _address(self, store):
        codes = store.address_codes
        if all(codes.get(k) for k in ("sigungu_cd", "bjdong_cd", "bun", "ji")):
            return codes
        if not self.settings.kakao_rest_key:
            raise ValueError("MISSING_ADDRESS_KEY")
        documents = address_tool.search(self.client, self.settings.kakao_rest_key, store.address)
        if len(documents) != 1:
            raise ValueError("ADDRESS_AMBIGUOUS_OR_MISSING")
        return address_tool.codes_from_document(documents[0])

    def _building_rows(self, url: str, params: dict) -> list[dict]:
        """건축HUB 목록을 끝까지 읽는다. 제공자 오류·불완전한 페이지는 예외 (조회 실패)."""
        rows, expected, seen = [], None, set()
        for page in range(1, 31):
            payload = self._get(url, params={**params, "pageNo": str(page)}).json()["response"]
            header = payload["header"]
            if str(header.get("resultCode")) not in {"00", "0"}:
                raise ProviderError("BUILDING_PROVIDER_ERROR", str(header.get("resultCode")), header.get("resultMsg"))
            body = payload["body"]
            total = int(body["totalCount"])
            if expected is not None and expected != total:
                raise ValueError("BUILDING_INCOMPLETE")
            expected = total
            batch = _rows((body.get("items") or {}).get("item"))
            signature = repr(batch)
            if batch and signature in seen:
                raise ValueError("BUILDING_REPEATED_PAGE")
            seen.add(signature)
            rows.extend(batch)
            if len(rows) == total:
                return rows
            if not batch or len(rows) > total:
                raise ValueError("BUILDING_INCOMPLETE")
        raise ValueError("BUILDING_PAGE_LIMIT")

    def building(self, store):
        """가게 층(입력에 호가 있으면 그 호실)의 원본 용도 행과 대상 공간을 돌려준다.

        층 없음·층 행 없음·건물 여러 개·호실 불일치 같은 데이터 결과는 예외가 아니라 space.status 로 돌려준다
        (예외는 통신·제공자 오류만. 예외면 분석 도구가 캐시·모의 응답으로 대체하므로 데이터 결과를 예외로 만들지 않는다).
        """
        key = self.settings.building_api_key or self.settings.data_go_kr_key
        if not key:
            raise ValueError("MISSING_BUILDING_KEY")
        codes = self._address(store)
        detail = building_use.parse_detail(store.address_detail)
        params = {"serviceKey": unquote(key), "sigunguCd": codes["sigungu_cd"], "bjdongCd": codes["bjdong_cd"],
                  "platGbCd": codes.get("plat_gb_cd", "0"), "bun": codes["bun"], "ji": codes["ji"],
                  "_type": "json", "numOfRows": "100"}
        floor_rows: list[dict] = []
        unit_rows: list[dict] | None = None
        if detail["floor"]:
            floor_rows = self._building_rows(BUILDING_URL, params)
            if detail["ho"]:
                # 요청에 hoNm 을 넣었다고 그 호실로 보지 않는다. 응답 행의 동·층·호를 resolve_space 가 다시 대조한다
                unit_rows = self._building_rows(BUILDING_UNIT_URL, {**params, "hoNm": detail["ho"]})
        target = [r for r in floor_rows if str(r.get("flrNo")) == detail["floor"]]
        space = building_use.resolve_space(floor_rows, unit_rows, detail)
        # 주소 코드도 함께 돌려줘 분석 결과 저장 때 stores.address_codes 로 남긴다 (관할 기관 연락처에 쓴다)
        data = {
            "schema": building_use.SPACE_SCHEMA,
            "space": space,
            "floor_rows": [building_use.keep_row(r) for r in target],
            "unit_rows": None if unit_rows is None else [building_use.keep_row(r) for r in unit_rows],
            "violation": None,  # 층별개요·전유부 응답에 위반건축물 표기가 없다 (지어내지 않는다)
            "address_codes": codes,
        }
        source = "건축HUB 전유부·층별개요" if space["status"] == building_use.UNIT_MATCHED else "건축HUB 층별개요"
        return ToolResult(ok=True, source=source, fetched_at=now_utc(), data=data)

    def grants(self, store):
        """K-Startup 모집 중 공고에서 이 가게가 볼 만한 공고를 고른다 (자격 판정은 agent/grants.py)."""
        if not self.settings.data_go_kr_key:
            raise ValueError("MISSING_DATA_GO_KR_KEY")
        rows = kstartup.fetch(self.client, self.settings.data_go_kr_key)
        grants, counts = kstartup.select(rows, store.address, today_kst())
        return ToolResult(ok=True, source=kstartup.SOURCE, fetched_at=now_utc(),
                          data={"grants": grants, "screened": counts, "total": len(rows)})

    def trademark(self, name):
        if not self.settings.kipris_api_key:
            raise ValueError("MISSING_KIPRIS_KEY")
        flags = {k: "false" for k in ("application", "refused", "expiration", "withdrawal", "publication", "cancel", "abandonment")}
        flags.update({k: "true" for k in (
            "registration", "trademark", "serviceMark", "trademarkServiceMark", "businessEmblem", "collectiveMark",
            "geoOrgMark", "internationalMark", "certMark", "geoCertMark", "character", "figure",
            "compositionCharacter", "figureComposition", "fragrance", "sound", "color", "colorMixed",
            "dimension", "hologram", "invisible", "motion", "visual")})
        params = {**flags, "ServiceKey": unquote(self.settings.kipris_api_key), "trademarkName": name,
                  "classification": "43", "numOfRows": "100"}
        items, expected, seen = [], None, set()
        for page in range(1, 11):
            raw = self._get(TRADEMARK_URL, params={**params, "pageNo": str(page)}).content
            if len(raw) > 2_000_000 or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
                raise ValueError("INVALID_KIPRIS_XML")
            root = ET.fromstring(raw)
            for node in root.iter():
                node.tag = node.tag.rsplit("}", 1)[-1]
            if root.tag != "response":
                raise ValueError("INVALID_KIPRIS_XML")
            if root.findtext("header/resultCode") != "00" or root.findtext("header/successYN") != "Y":
                raise ProviderError("KIPRIS_PROVIDER_ERROR", root.findtext("header/resultCode"), root.findtext("header/resultMsg"))
            total = int(root.findtext("count/totalCount"))
            if int(root.findtext("count/pageNo")) != page or (expected is not None and total != expected):
                raise ValueError("KIPRIS_INCOMPLETE")
            expected = total
            batch = root.findall("body/items/item")
            for node in batch:
                signature = ET.tostring(node)
                if signature in seen:
                    raise ValueError("KIPRIS_REPEATED_PAGE")
                seen.add(signature)
                items.append(node)
            if len(items) == total:
                break
            if not batch or len(items) > total:
                raise ValueError("KIPRIS_INCOMPLETE")
        else:
            raise ValueError("KIPRIS_PAGE_LIMIT")
        candidates = {}
        for node in items:
            status = (node.findtext("applicationStatus") or "").strip()
            classes = [c.strip() for c in (node.findtext("classificationCode") or "").split("|")]
            if status not in {"출원", "등록", "거절", "소멸", "취하", "공고", "무효", "포기"}:
                raise ValueError("UNKNOWN_KIPRIS_STATUS")
            if any(not re.fullmatch(r"\d{2}", c) or not 1 <= int(c) <= 45 for c in classes):
                raise ValueError("INVALID_KIPRIS_CLASS")
            if status != "등록" or "43" not in classes:
                continue
            number, title = node.findtext("registrationNumber") or "", node.findtext("title") or ""
            if not re.fullmatch(r"\d{13}", number) or not title:
                raise ValueError("INVALID_KIPRIS_RECORD")
            record = {"reg_no": number, "name": title, "class_code": "43", "status": status,
                      "url": "https://www.kipris.or.kr/"}
            if number in candidates and candidates[number] != record:
                raise ValueError("KIPRIS_CONFLICTING_RECORD")
            candidates[number] = record
        return ToolResult(ok=True, source="KIPRIS Plus 상표 명칭검색(제43류 등록)", fetched_at=now_utc(),
                          data={"similar": list(candidates.values()), "search_scope": "name", "query": name})

    def _law_version(self, name: str, today: str) -> tuple[str, str]:
        key = (name, today)
        if key in self._law_versions:
            return self._law_versions[key]
        payload = self._get(f"{LAW_BASE}/lawSearch.do", params={"OC": self.settings.law_oc,
            "target": "eflaw", "type": "JSON", "query": name, "nw": "3", "display": "100"}).json()
        root = payload["LawSearch"]
        if int(root["totalCnt"]) > 100:
            raise ValueError("LAW_SEARCH_INCOMPLETE")
        matches = [r for r in _rows(root.get("law")) if r.get("법령명한글") == name
                   and r.get("현행연혁코드") == "현행"]
        if len(matches) != 1:
            raise ValueError("LAW_NOT_UNIQUE")
        law = matches[0]
        mst, effective = str(law["법령일련번호"]), str(law["시행일자"])
        if not mst.isdigit():
            raise ValueError("INVALID_LAW_ID")
        if not re.fullmatch(r"\d{8}", effective):
            raise ValueError("INVALID_LAW_DATE")
        if effective > today:
            raise ValueError("LAW_NOT_EFFECTIVE")
        self._law_versions[key] = (mst, effective)
        return mst, effective

    def _law_article(self, ref: dict, today: str) -> dict:
        name, kind, number = ref["law_name"], ref.get("kind", "article"), int(ref["number"])
        mst, effective = self._law_version(name, today)
        key = (name, mst, effective, kind, number)
        if key in self._law_articles:
            return self._law_articles[key].copy()
        params = {"OC": self.settings.law_oc, "target": "eflaw", "type": "JSON", "MST": mst, "efYd": effective}
        if kind == "article":
            params["JO"] = f"{number:04d}00"
        body = self._get(f"{LAW_BASE}/lawService.do", params=params).json()["법령"]
        if body["기본정보"]["법령명_한글"] != name:
            raise ValueError("LAW_MISMATCH")
        if str(body["기본정보"].get("시행일자")) != effective:
            raise ValueError("LAW_VERSION_MISMATCH")
        group = "별표" if kind == "annex" else "조문"
        units = [r for r in _rows(body.get(group, {}).get(group + "단위"))
                 if int(r.get(group + "번호", -1)) == number
                 and r.get(group + "구분", r.get("조문여부")) == group]
        if len(units) != 1:
            raise ValueError("LAW_REFERENCE_MISSING")
        parts = []

        def collect(value):
            if isinstance(value, str):
                parts.append(value)
            elif isinstance(value, list):
                for entry in value:
                    collect(entry)
            elif isinstance(value, dict):
                for field, entry in value.items():
                    if field.endswith("내용") or field in {"항", "호", "목"}:
                        collect(entry)

        collect(units[0])
        text = "\n".join(parts).strip()
        if not text:
            raise ValueError("LAW_TEXT_MISSING")
        article = {"law_name": name, "article": f"별표 {number}" if kind == "annex" else f"제{number}조",
                   "text": text, "url": f"https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq={mst}"}
        self._law_articles[key] = article
        return article.copy()

    def law(self, check_id, store=None):
        refs = self.references.get(check_id)
        if not refs:
            return ToolResult(ok=False, source="국가법령정보", error="LAW_REFERENCE_UNCONFIRMED")
        if not self.settings.law_oc:
            raise ValueError("MISSING_LAW_OC")
        today = today_kst().strftime("%Y%m%d")
        articles = [self._law_article(ref, today) for ref in refs]
        return ToolResult(ok=True, source="국가법령정보센터", fetched_at=now_utc(), data={"articles": articles})
