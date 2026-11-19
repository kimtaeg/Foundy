"""상표 명칭·43류 등록 후보 조회 확인. --mock이 없으면 실제 호출만 확인한다."""

import argparse
import json
from pathlib import Path
import sys

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from tools.runtime import load_tool_environment  # noqa: E402
from tools.trademark import TRADEMARK_URL, TrademarkTool  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="모노커피")
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--env-file", type=Path)
    args = parser.parse_args()
    paths = ([args.env_file] if args.env_file else
             [p for p in (BACKEND.parent / ".env", BACKEND / ".env") if p.is_file()])
    try:
        config = load_tool_environment(env_files=paths)
        with httpx.Client() as client:
            tool = TrademarkTool(client, api_key=config.get("KIPRIS_API_KEY") or "",
                                 endpoint=config.get("KIPRIS_TRADEMARK_URL") or TRADEMARK_URL,
                                 use_mock=args.mock, allow_fallback=False)
            result = tool.trademark(args.name)
    except OSError:
        parser.error("설정 파일을 읽을 수 없습니다")
    except ValueError:
        parser.error("KIPRIS 설정이 올바르지 않습니다. 승인된 HTTPS getAdvancedSearch 주소를 사용하세요")
    print(json.dumps({"mode": "mock" if args.mock else "live", "result": result.model_dump(mode="json")},
                     ensure_ascii=False, indent=2))
    return 0 if result.ok and result.from_mock == args.mock and not result.from_cache else 1


if __name__ == "__main__":
    raise SystemExit(main())
