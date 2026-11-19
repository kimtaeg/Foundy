"""KIPRIS 공식 getAdvancedSearch 계약으로 43류 등록 후보를 확인한다. 실제 모드는 대체하지 않는다."""

from __future__ import annotations

from pathlib import Path
import sys

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from _common import ProbeReport, Step  # noqa: E402
from tools.trademark import TRADEMARK_URL, TrademarkTool  # noqa: E402
from tools.runtime import load_tool_environment  # noqa: E402

DEMO_BRAND = "모노커피"


def run() -> ProbeReport:
    rep = ProbeReport(api="KIPRIS Plus 상표 출원 속보")
    backend = Path(__file__).resolve().parents[2]
    paths = [p for p in (backend.parent / ".env", backend / ".env") if p.is_file()]
    try:
        config = load_tool_environment(env_files=paths)
    except (OSError, ValueError):
        rep.steps.append(Step(name="설정 확인", failure="코드·파라미터", note="설정 파일을 읽을 수 없음"))
        return rep
    key = (config.get("KIPRIS_API_KEY") or "").strip()
    if not key:
        rep.steps.append(Step(name="키 확인", failure="키·승인·IP", note="KIPRIS_API_KEY 없음 (승인 여부와 별개)"))
        return rep
    try:
        with httpx.Client() as client:
            result = TrademarkTool(client, api_key=key, endpoint=config.get("KIPRIS_TRADEMARK_URL") or TRADEMARK_URL,
                                   allow_fallback=False).trademark(DEMO_BRAND)
    except ValueError:
        rep.steps.append(Step(name="설정 확인", failure="코드·파라미터", note="지원하지 않는 KIPRIS 요청 주소"))
        return rep
    rep.steps.append(Step(name="상표명칭·43류 등록 후보", ok=result.ok,
                          failure=None if result.ok else "공급자·요청·인증 확인 필요", note=result.error or "정규화 완료"))
    rep.checks["공식 요청 주소"] = TRADEMARK_URL
    rep.checks["응답 출처"] = {"source": result.source, "from_mock": result.from_mock, "from_cache": result.from_cache}
    if result.ok:
        rep.checks["등록 후보 수"] = len(result.data["similar"])
        rep.checks["공급자 행 수"] = result.data["provider_count"]
    return rep


if __name__ == "__main__":
    run().print()
