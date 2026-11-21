"""법제처 국가법령정보 공동활용 API에서 법령 본문을 가져온다 (OC 인증키에 등록된 IP에서만 동작한다)."""

from __future__ import annotations

import logging

import httpx

from config import get_settings
from law_rag.parser import ParsedLaw, parse_law

LAW_BASE = "https://www.law.go.kr/DRF"
logger = logging.getLogger(__name__)


class LawApiError(Exception):
    pass


class LawCollector:
    def __init__(self, client: httpx.Client | None = None, oc: str | None = None):
        self.client = client or httpx.Client(timeout=30, follow_redirects=False)
        self.oc = oc if oc is not None else get_settings().law_oc

    def close(self) -> None:
        self.client.close()

    def _get(self, endpoint: str, params: dict) -> dict:
        if not self.oc:
            raise LawApiError("LAW_OC 가 설정되지 않았습니다")
        response = self.client.get(f"{LAW_BASE}/{endpoint}", params={"OC": self.oc, "type": "JSON", **params})
        response.raise_for_status()
        payload = response.json()
        if "result" in payload and "사용자 정보 검증" in str(payload.get("result")):
            raise LawApiError("법제처가 요청 IP를 허용하지 않습니다 (OC에 이 서버의 IP를 등록해야 합니다)")
        return payload

    def find_current(self, name: str) -> dict:
        """현행 법령 검색에서 법령명이 정확히 같은 한 건 ({법령일련번호, 시행일자, …})."""
        payload = self._get("lawSearch.do", {"target": "eflaw", "query": name, "nw": "3", "display": "100"})
        rows = payload.get("LawSearch", {}).get("law") or []
        rows = rows if isinstance(rows, list) else [rows]
        matches = [r for r in rows if r.get("법령명한글") == name and r.get("현행연혁코드") == "현행"]
        if len(matches) != 1:
            raise LawApiError(f"현행 법령 '{name}' 을(를) 하나로 특정하지 못했습니다 ({len(matches)}건)")
        return matches[0]

    def fetch(self, name: str) -> ParsedLaw:
        found = self.find_current(name)
        mst, effective = str(found["법령일련번호"]), str(found["시행일자"])
        payload = self._get("lawService.do", {"target": "eflaw", "MST": mst, "efYd": effective})
        law = parse_law(payload, mst=mst)
        if law.name != name:
            raise LawApiError(f"본문의 법령명이 다릅니다: {law.name}")
        return law
