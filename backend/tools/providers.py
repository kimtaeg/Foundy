"""공식 조회 응답을 분석 계약으로 변환한다. 판정·법령 참조 결정은 하지 않는다."""

import re
import xml.etree.ElementTree as ET
from urllib.parse import unquote

import httpx

from agent.ports import ToolResult
from config import get_settings
from services.pack import get_pack
from services.timeutil import now_utc, today_kst
from tools import address as address_tool

KAKAO_URL = address_tool.KAKAO_URL
BUILDING_URL = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrFlrOulnInfo"
TRADEMARK_URL = "https://plus.kipris.or.kr/kipo-api/kipi/trademarkInfoSearchService/getAdvancedSearch"
LAW_BASE = "https://www.law.go.kr/DRF"


def _rows(value):
    return value if isinstance(value, list) else [value] if isinstance(value, dict) else []


class Providers:
    def __init__(self, client=None, settings=None, references=None):
        self.settings = settings or get_settings()
        self.client = client or httpx.Client(timeout=10, follow_redirects=False)
        self.references = references if references is not None else get_pack().get("law_references", {})

    def close(self):
        self.client.close()

    def _get(self, url, **kwargs):
        response = self.client.get(url, **kwargs)
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

    def building(self, store):
        key = self.settings.building_api_key or self.settings.data_go_kr_key
        if not key:
            raise ValueError("MISSING_BUILDING_KEY")
        codes = self._address(store)
        floor = re.search(r"(지하\s*|B\s*)?(\d+)\s*층", store.address_detail or "", re.I)
        if not floor:
            raise ValueError("FLOOR_REQUIRED")
        params = {"serviceKey": unquote(key), "sigunguCd": codes["sigungu_cd"], "bjdongCd": codes["bjdong_cd"],
                  "platGbCd": codes.get("plat_gb_cd", "0"), "bun": codes["bun"], "ji": codes["ji"],
                  "_type": "json", "numOfRows": "100"}
        rows, expected, seen = [], None, set()
        for page in range(1, 11):
            payload = self._get(BUILDING_URL, params={**params, "pageNo": str(page)}).json()["response"]
            if str(payload["header"].get("resultCode")) not in {"00", "0"}:
                raise ValueError("BUILDING_PROVIDER_ERROR")
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
                break
            if not batch or len(rows) > total:
                raise ValueError("BUILDING_INCOMPLETE")
        else:
            raise ValueError("BUILDING_PAGE_LIMIT")
        selected = [r for r in rows if str(r.get("flrNo")) == floor.group(2)
                    and r.get("flrGbCdNm") == ("지하" if floor.group(1) else "지상")
                    and r.get("mainAtchGbCdNm") == "주건축물"]
        buildings = {r.get("mgmBldrgstPk") or r.get("bldrgstSeqno") or r.get("dongNm") for r in selected}
        if len(buildings) > 1:
            raise ValueError("BUILDING_AMBIGUOUS")
        uses = sorted({re.sub(r"\s", "", r["mainPurpsCdNm"]) for r in selected if r.get("mainPurpsCdNm")})
        if not uses:
            raise ValueError("FLOOR_USE_UNAVAILABLE")
        return ToolResult(ok=True, source="건축HUB 층별개요", fetched_at=now_utc(),
                          data={"floor_uses": uses, "violation": None})

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
            if root.tag != "response" or root.findtext("header/resultCode") != "00" or root.findtext("header/successYN") != "Y":
                raise ValueError("KIPRIS_PROVIDER_ERROR")
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

    def law(self, check_id):
        refs = self.references.get(check_id)
        if not refs:
            return ToolResult(ok=False, source="국가법령정보", error="LAW_REFERENCE_UNCONFIRMED")
        if not self.settings.law_oc:
            raise ValueError("MISSING_LAW_OC")
        articles = []
        for ref in refs:
            name = ref["law_name"]
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
            if not str(law["법령일련번호"]).isdigit():
                raise ValueError("INVALID_LAW_ID")
            effective = str(law["시행일자"])
            if not re.fullmatch(r"\d{8}", effective):
                raise ValueError("INVALID_LAW_DATE")
            if effective > today_kst().strftime("%Y%m%d"):
                raise ValueError("LAW_NOT_EFFECTIVE")
            params = {"OC": self.settings.law_oc, "target": "eflaw", "type": "JSON",
                      "MST": law["법령일련번호"], "efYd": effective}
            kind = ref.get("kind", "article")
            number = int(ref["number"])
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
                    for v in value:
                        collect(v)
                elif isinstance(value, dict):
                    for k, v in value.items():
                        if k.endswith("내용") or k in {"항", "호", "목"}:
                            collect(v)
            collect(units[0])
            text = "\n".join(parts).strip()
            if not text:
                raise ValueError("LAW_TEXT_MISSING")
            articles.append({"law_name": name, "article": f"별표 {number}" if kind == "annex" else f"제{number}조",
                             "text": text, "url": f"https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq={law['법령일련번호']}"})
        return ToolResult(ok=True, source="국가법령정보센터", fetched_at=now_utc(), data={"articles": articles})
