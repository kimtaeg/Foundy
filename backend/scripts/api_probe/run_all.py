"""외부 API 프로브를 순서대로 실행하고 요약을 출력한다.

    cd backend && python scripts/api_probe/run_all.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import probe_kakao_building  # noqa: E402
import probe_kakao_places  # noqa: E402
import probe_kipris  # noqa: E402
import probe_law  # noqa: E402
from _common import ProbeReport, Step, mask  # noqa: E402

PROBES = [probe_kakao_building, probe_law, probe_kipris, probe_kakao_places]


def main() -> int:
    reports: list[ProbeReport] = []
    for mod in PROBES:
        try:
            rep = mod.run()
        except Exception as e:  # 한 프로브가 죽어도 나머지는 돈다
            rep = ProbeReport(api=mod.__name__)
            rep.steps.append(Step(name="실행", failure="코드·파라미터", note=mask(f"{type(e).__name__}: {e}")))
        rep.print()
        reports.append(rep)

    print("\n=== 요약 ===")
    print(f"{'API':<40} {'성공':>4} {'실패':>4}  실패 원인")
    for r in reports:
        ok = sum(s.ok for s in r.steps)
        ng = [s for s in r.steps if not s.ok]
        causes = ", ".join(sorted({s.failure or "?" for s in ng})) or "-"
        print(f"{r.api:<40} {ok:>4} {len(ng):>4}  {causes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
