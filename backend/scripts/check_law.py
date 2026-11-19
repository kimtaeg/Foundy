"""명시한 법령·조문을 확인한다. --mock이 없으면 캐시·mock 대체 없이 실제 호출한다."""

import argparse
import json
from pathlib import Path
import sys

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from tools.law import LawReference, LawTool  # noqa: E402
from tools.runtime import load_tool_environment  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--law-name", required=True)
    reference = parser.add_mutually_exclusive_group(required=True)
    reference.add_argument("--article", type=int)
    reference.add_argument("--annex", type=int)
    parser.add_argument("--sub-number", type=int, default=0)
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--env-file", type=Path)
    args = parser.parse_args()
    try:
        ref = LawReference(args.law_name, args.article if args.article is not None else args.annex,
                           "article" if args.article is not None else "annex", args.sub_number)
    except ValueError:
        parser.error("법령명·조문·별표 번호가 올바르지 않습니다")
    paths = ([args.env_file] if args.env_file else
             [p for p in (BACKEND.parent / ".env", BACKEND / ".env") if p.is_file()])
    try:
        config = load_tool_environment(env_files=paths)
    except (OSError, ValueError):
        parser.error("설정 파일을 읽을 수 없습니다")
    with httpx.Client() as client:
        result = LawTool(client, references={"law_probe": [ref]}, oc=(config.get("LAW_OC") or "").strip(),
                         use_mock=args.mock, allow_fallback=False).law("law_probe")
    print(json.dumps({"mode": "mock" if args.mock else "live", "result": result.model_dump(mode="json")},
                     ensure_ascii=False, indent=2))
    return 0 if result.ok and result.from_mock == args.mock and not result.from_cache else 1


if __name__ == "__main__":
    raise SystemExit(main())
