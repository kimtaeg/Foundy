"""주소 → 법정동코드·번·지 (카카오 로컬 주소 검색). 가게 등록과 건축물대장 조회가 같이 쓴다.

상태:
- resolved: 실제 조회로 결과가 하나 → 코드 저장
- not_found / ambiguous: 실제 조회 결과가 없거나 여럿 → 등록 API는 422 ADDRESS_NOT_RESOLVED (후보 함께)
- unverified: 키가 없거나 USE_MOCK=true 라 조회하지 않음 → 코드 없이 등록 (모의 주소 코드는 다른 주소의 값이라 쓰지 않는다)
- lookup_failed: 조회 서비스 장애(네트워크·5xx·키 오류) → 주소를 못 찾은 것과 구분해 코드 없이 등록
"""

import re
import time
from dataclasses import dataclass, field

import httpx

from tools import retry
from tools.failure import classify, log_failure

KAKAO_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KAKAO_COORD_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json"
MAX_CANDIDATES = 5


class AddressCodeError(ValueError):
    pass


@dataclass
class AddressResult:
    status: str
    codes: dict | None = None
    road: str | None = None
    jibun: str | None = None
    coord: dict | None = None
    region: str | None = None
    candidates: list[str] = field(default_factory=list)


def codes_from_document(document: dict) -> dict:
    """카카오 주소 문서 하나 → {sigungu_cd, bjdong_cd, bun, ji, plat_gb_cd}."""
    address = document.get("address") or {}
    code = address.get("b_code", "")
    if not re.fullmatch(r"\d{10}", code):
        raise AddressCodeError("INVALID_ADDRESS_CODE")
    return {"sigungu_cd": code[:5], "bjdong_cd": code[5:],
            "bun": str(address.get("main_address_no", "")).zfill(4),
            "ji": str(address.get("sub_address_no") or "0").zfill(4),
            "plat_gb_cd": "1" if address.get("mountain_yn") == "Y" else "0"}


def search(client: httpx.Client, key: str, query: str) -> list[dict]:
    response = retry.get(client, KAKAO_URL, params={"query": query}, headers={"Authorization": f"KakaoAK {key}"})
    response.raise_for_status()
    return response.json().get("documents", [])


def resolve_address(query: str, *, key: str, use_mock: bool, client: httpx.Client | None = None) -> AddressResult:
    if use_mock or not key:
        return AddressResult(status="unverified")
    own = client is None
    client = client or httpx.Client(timeout=10, follow_redirects=False)
    started = time.monotonic()
    try:
        documents = search(client, key, query)
    except (httpx.HTTPError, ValueError) as exc:
        log_failure("address", classify(exc), (time.monotonic() - started) * 1000, "failed")
        return AddressResult(status="lookup_failed")
    finally:
        if own:
            client.close()
    if not documents:
        return AddressResult(status="not_found")
    if len(documents) > 1:
        return AddressResult(status="ambiguous",
                             candidates=[d.get("address_name", "") for d in documents[:MAX_CANDIDATES]])
    document = documents[0]
    try:
        codes = codes_from_document(document)
    except AddressCodeError as exc:
        log_failure("address", classify(ValueError(str(exc))), (time.monotonic() - started) * 1000, "failed")
        return AddressResult(status="lookup_failed")
    address = document.get("address") or {}
    road = (document.get("road_address") or {}).get("address_name") or document.get("address_name")
    coord = None
    if document.get("x") and document.get("y"):
        coord = {"lat": float(document["y"]), "lng": float(document["x"])}
    return AddressResult(status="resolved", codes=codes, road=road, jibun=address.get("address_name"),
                         coord=coord, region=region_from_document(document))


def region_from_document(document: dict) -> str | None:
    """카카오 주소 문서 → 지번 지역 '시도 구 법정동' (예: '서울 관악구 봉천동'). 임대료 상권 매칭에 쓴다."""
    address = document.get("address") or {}
    return " ".join(p for p in (address.get("region_1depth_name"), address.get("region_2depth_name"),
                                address.get("region_3depth_name")) if p) or None


def region_from_coord(lat: float, lng: float, *, key: str, client: httpx.Client | None = None) -> str | None:
    """좌표 → 지번 지역 '시도 구 법정동' (카카오 coord2regioncode, 법정동 문서만).

    region_type 'B'(법정동) 문서만 쓴다. 'H'(행정동)는 임대료 상권 규칙(법정동 기준)과 맞지 않아 쓰지 않는다.
    키 없음·호출 실패·결과 없음은 None. 실패는 address_coord 로 기록한다 (URL·키는 남기지 않는다).
    """
    if not key:
        return None
    own = client is None
    client = client or httpx.Client(timeout=10, follow_redirects=False)
    started = time.monotonic()
    try:
        response = retry.get(client, KAKAO_COORD_URL, params={"x": lng, "y": lat},
                             headers={"Authorization": f"KakaoAK {key}"})
        response.raise_for_status()
        documents = response.json().get("documents", [])
    except (httpx.HTTPError, ValueError) as exc:
        log_failure("address_coord", classify(exc), (time.monotonic() - started) * 1000, "failed")
        return None
    finally:
        if own:
            client.close()
    for document in documents:
        if document.get("region_type") == "B":
            return " ".join(p for p in (document.get("region_1depth_name"), document.get("region_2depth_name"),
                                        document.get("region_3depth_name")) if p) or None
    return None
