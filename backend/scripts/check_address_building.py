"""실제 호출 또는 --mock 검증. 실제 모드에서는 fallback·캐시를 사용하지 않는다."""

import argparse
from datetime import date
from dataclasses import replace
import json
from pathlib import Path
import sys

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from agent.ports import StoreInput  # noqa: E402
from tools.runtime import AddressBuildingSettings, make_address_building_tools  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--address", default="서울 성동구 성수이로 113")
    parser.add_argument("--floor", default="1층")
    parser.add_argument("--mock", action="store_true", help="입력 일치 fixture만 사용")
    parser.add_argument("--env-file", type=Path, help="키를 읽을 .env 파일. 값은 출력하지 않음")
    args = parser.parse_args()
    paths = ([args.env_file] if args.env_file else
             [path for path in (BACKEND.parent / ".env", BACKEND / ".env") if path.is_file()])
    try:
        settings = AddressBuildingSettings.load(env_files=paths)
    except OSError:
        parser.error("설정 파일을 읽을 수 없습니다")
    except ValueError:
        parser.error("USE_MOCK 설정은 true/false 또는 1/0이어야 합니다")
    # 이 검증 명령은 --mock이 없으면 항상 실제 조회한다. .env의 기본 mock을 무시한다.
    settings = replace(settings, use_mock=args.mock)
    with httpx.Client() as client:
        tools = make_address_building_tools(client, settings, allow_fallback=False)
        address = tools.address.resolve_address(args.address)
        if not address.ok:
            print(json.dumps({"mode": "mock" if args.mock else "live", "address": address.model_dump(mode="json"),
                              "building": None}, ensure_ascii=False, indent=2))
            return 1
        store = StoreInput(store_id="tool-check", name="조회 검증", address=args.address,
                           address_detail=args.floor, address_codes=address.data["codes"],
                           opening_date=date(2027, 3, 2))
        building = tools.building.building(store)
    print(json.dumps({"mode": "mock" if args.mock else "live", "address": address.model_dump(mode="json"),
                      "building": building.model_dump(mode="json")}, ensure_ascii=False, indent=2))
    origin_ok = all(r.from_mock == args.mock and not r.from_cache for r in (address, building))
    return 0 if building.ok and origin_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
