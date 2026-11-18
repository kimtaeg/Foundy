"""프로브 공통 처리: .env 읽기, 키 마스킹, 호출·시간 측정, 응답 저장, 개인정보 가림.

키 값은 이 모듈 밖으로 평문으로 나가지 않게 한다.
출력·저장되는 모든 문자열은 mask()를 거친다.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import quote, quote_plus

import httpx
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
MOCKS_DIR = BACKEND_DIR / "mocks"
ENV_PATH = BACKEND_DIR / ".env"
TIMEOUT = 10.0

KEY_NAMES = ["KAKAO_REST_KEY", "DATA_GO_KR_KEY", "LAW_OC", "KIPRIS_API_KEY", "SEOUL_OPENDATA_KEY"]

load_dotenv(ENV_PATH)

# URL 쿼리·헤더에서 값을 가릴 파라미터 이름
_SECRET_PARAM_RE = re.compile(
    r"(?i)\b(serviceKey|OC|accessKey|apiKey)(=)([^&\s\"'<>]+)|\b(KakaoAK)(\s+)(\S+)"
)


def _secret_values() -> list[str]:
    values: list[str] = []
    for name in KEY_NAMES:
        v = os.getenv(name)
        if v:
            values += [v, quote(v, safe=""), quote_plus(v)]
    # 긴 것부터 바꿔야 부분 치환으로 일부가 남지 않는다
    return sorted(set(values), key=len, reverse=True)


def mask(text: str) -> str:
    for v in _secret_values():
        if len(v) >= 3:
            text = text.replace(v, "***")
    return _SECRET_PARAM_RE.sub(
        lambda m: f"{m.group(1)}{m.group(2)}***" if m.group(1) else f"{m.group(4)}{m.group(5)}***",
        text,
    )


def get_key(name: str) -> str | None:
    v = os.getenv(name)
    return v.strip() if v and v.strip() else None


def require_keys(*names: str) -> list[str]:
    """비어 있는 키 이름 목록을 돌려준다 (값은 절대 돌려주지 않음)."""
    return [n for n in names if not get_key(n)]


@dataclass
class Step:
    name: str
    status: int | None = None
    elapsed_ms: int | None = None
    ok: bool = False
    failure: str | None = None   # "키·승인·IP" / "네트워크" / "코드·파라미터" / "데이터 없음"
    note: str = ""
    url: str = ""                # 마스킹된 URL


@dataclass
class ProbeReport:
    api: str
    steps: list[Step] = field(default_factory=list)
    checks: dict[str, Any] = field(default_factory=dict)
    saved: list[str] = field(default_factory=list)

    def print(self) -> None:
        print(f"\n=== {self.api} ===")
        for s in self.steps:
            mark = "OK " if s.ok else "NG "
            st = s.status if s.status is not None else "-"
            ms = f"{s.elapsed_ms}ms" if s.elapsed_ms is not None else "-"
            fail = f" [{s.failure}]" if s.failure else ""
            print(mask(f"  {mark}{s.name}: HTTP {st}, {ms}{fail} {s.note}".rstrip()))
        for k, v in self.checks.items():
            print(mask(f"  - {k}: {v}"))
        for p in self.saved:
            print(f"  saved: {p}")


def call(step_name: str, url: str, *, params: dict | None = None,
         headers: dict | None = None) -> tuple[Step, httpx.Response | None]:
    step = Step(name=step_name)
    t0 = time.perf_counter()
    try:
        with httpx.Client(timeout=TIMEOUT, follow_redirects=False) as client:
            resp = client.get(url, params=params, headers=headers)
    except httpx.TimeoutException:
        step.elapsed_ms = int((time.perf_counter() - t0) * 1000)
        step.failure, step.note = "네트워크", f"타임아웃 {TIMEOUT:.0f}초"
        return step, None
    except httpx.HTTPError as e:
        step.elapsed_ms = int((time.perf_counter() - t0) * 1000)
        step.failure, step.note = "네트워크", mask(f"{type(e).__name__}: {e}")
        return step, None
    step.elapsed_ms = int((time.perf_counter() - t0) * 1000)
    step.status = resp.status_code
    step.url = mask(str(resp.request.url))
    if resp.status_code in (401, 403):
        step.failure = "키·승인·IP"
    elif resp.status_code == 429:
        step.failure, step.note = "키·승인·IP", "호출 한도 초과"
    elif 300 <= resp.status_code < 400:
        step.failure, step.note = "코드·파라미터", f"리다이렉트 → {mask(resp.headers.get('location', ''))}"
    elif resp.status_code >= 400:
        step.failure = "코드·파라미터"
    else:
        step.ok = True
    return step, resp


def parse_json(resp: httpx.Response) -> Any | None:
    try:
        return resp.json()
    except (json.JSONDecodeError, ValueError):
        return None


PII_KEYS = {"phone", "tel", "telno", "ownernm", "ownrnm", "ownername", "rgstnm", "applicantname"}


def redact_pii(obj: Any) -> Any:
    """사람·연락처로 보이는 필드 값을 가린다."""
    if isinstance(obj, dict):
        return {k: ("[가림]" if k.lower() in PII_KEYS and obj[k] else redact_pii(v))
                for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact_pii(v) for v in obj]
    return obj


def save(filename: str, resp: httpx.Response, *, redact: bool = True) -> str:
    """응답 원본을 mocks/에 저장한다. JSON이면 개인정보를 가리고, 키 문자열이 남아 있으면 저장하지 않는다."""
    MOCKS_DIR.mkdir(parents=True, exist_ok=True)
    data = parse_json(resp)
    if data is not None:
        text = json.dumps(redact_pii(data) if redact else data, ensure_ascii=False, indent=2)
    else:
        text = resp.text
    text = mask(text)
    for v in _secret_values():
        if len(v) >= 3 and v in text:
            raise RuntimeError(f"{filename}: 키 문자열이 남아 있어 저장을 중단했다")
    path = MOCKS_DIR / filename
    path.write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")
    return str(path.relative_to(BACKEND_DIR))


def find_fields(obj: Any, needles: tuple[str, ...], path: str = "") -> list[str]:
    """키 이름이나 값에 needles 중 하나가 들어간 위치를 찾는다."""
    hits: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else k
            if any(n.lower() in k.lower() for n in needles):
                hits.append(p)
            hits += find_fields(v, needles, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += find_fields(v, needles, f"{path}[{i}]")
    elif isinstance(obj, str) and any(n.lower() in obj.lower() for n in needles):
        hits.append(f"{path} = {obj[:40]}")
    return hits


def all_keys(items: list[dict]) -> list[str]:
    keys: list[str] = []
    for it in items:
        for k in it:
            if k not in keys:
                keys.append(k)
    return keys
