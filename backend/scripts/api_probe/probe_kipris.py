"""3. KIPRIS Plus 상표 출원 속보.

TODO(사용자 확인 대기): 요청 주소와 파라미터 이름을 KIPRIS Plus 상품 상세에서 받은 뒤 채운다.
  - 일반검색(getWordSearch) 요청 주소, 검색어 파라미터 이름
  - 상표명칭 검색 오퍼레이션 이름과 파라미터
  - 상품분류(제43류) 필터 파라미터 이름
  - 키 파라미터 이름 (ServiceKey / accessKey 중 무엇인지)
엔드포인트를 추측하지 않기 위해 지금은 호출하지 않는다.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import ProbeReport, Step  # noqa: E402

DEMO_BRAND = "모노커피"


def run() -> ProbeReport:
    rep = ProbeReport(api="KIPRIS Plus 상표 출원 속보")
    rep.steps.append(Step(name="요청 주소 확인", failure="키·승인·IP",
                          note="승인 대기 · 요청 주소 미입력 (TODO)"))
    return rep


if __name__ == "__main__":
    run().print()
