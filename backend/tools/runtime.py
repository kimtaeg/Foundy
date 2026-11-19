"""서버가 주입할 설정·HTTP 클라이언트·캐시로 주소/건축물 도구를 조립한다."""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Mapping, Sequence
import os

import httpx
from dotenv import dotenv_values

from ._common import utcnow
from .address import AddressTool
from .building import BuildingTool
from .cache import ToolCache


@dataclass(frozen=True)
class AddressBuildingSettings:
    kakao_key: str = field(default="", repr=False)
    building_key: str = field(default="", repr=False)
    use_mock: bool = False

    @classmethod
    def load(cls, *, env_files: Sequence[Path] = (),
             environ: Mapping[str, str] | None = None) -> "AddressBuildingSettings":
        """뒤 파일·실행 환경 순으로 우선한다. 명시한 파일은 반드시 존재해야 한다.

        전역 환경은 변경하지 않으며 dotenv의 암묵적 환경 참조 확장도 하지 않는다.
        기본값은 파일을 읽지 않는다. 서버가 원하는 설정 경로를 직접 지정한다.
        """
        config: dict[str, str | None] = {}
        for path in env_files:
            with Path(path).open(encoding="utf-8") as stream:
                config.update(dotenv_values(stream=stream, interpolate=False))
        config.update(os.environ if environ is None else environ)
        raw_mock = (config.get("USE_MOCK") or "false").strip().lower()
        if raw_mock not in ("true", "false", "1", "0"):
            raise ValueError("INVALID_USE_MOCK: true/false 또는 1/0을 사용하세요")
        return cls(kakao_key=(config.get("KAKAO_REST_KEY") or "").strip(),
                   building_key=(config.get("DATA_GO_KR_KEY") or "").strip(),
                   use_mock=raw_mock in ("true", "1"))


@dataclass(frozen=True)
class AddressBuildingTools:
    address: AddressTool
    building: BuildingTool


def make_address_building_tools(client: httpx.Client, settings: AddressBuildingSettings, *,
                                cache: ToolCache | None = None,
                                allow_fallback: bool = True,
                                clock: Callable[[], datetime] = utcnow) -> AddressBuildingTools:
    """HTTP 수명·캐시 구현은 호출자 소유. 전체 agent.Tools 구현은 아니다."""
    address = AddressTool(client, api_key=settings.kakao_key, cache=cache,
                          use_mock=settings.use_mock, allow_fallback=allow_fallback, clock=clock)
    building = BuildingTool(client, api_key=settings.building_key, address_tool=address,
                            cache=cache, use_mock=settings.use_mock,
                            allow_fallback=allow_fallback, clock=clock)
    return AddressBuildingTools(address=address, building=building)
