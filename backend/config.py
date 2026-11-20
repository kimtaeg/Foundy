"""환경변수 설정. backend/.env(로컬) 또는 Railway 서비스 변수에서 읽는다.

여기서 쓰는 이름은 모두 .env.example 에 있다. 새 이름을 쓰면 .env.example 에 이름만 추가한다.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = ""
    frontend_origin: str = "http://localhost:3000"
    use_mock: bool = True
    # 예시 계정 토큰(HS256) 서명 키. 비우면 서버 시작마다 임시 키를 만든다 (재시작하면 토큰이 무효)
    jwt_secret: str = ""
    analysis_timeout_seconds: int = Field(default=600, gt=0)
    analysis_workers: int = Field(default=2, gt=0, le=8)
    kakao_rest_key: str = Field(default="", repr=False)
    building_api_key: str = Field(default="", repr=False)
    data_go_kr_key: str = Field(default="", repr=False)
    law_oc: str = Field(default="", repr=False)
    kipris_api_key: str = Field(default="", repr=False)

    @property
    def frontend_origins(self) -> list[str]:
        """FRONTEND_ORIGIN 은 쉼표로 여러 개를 줄 수 있다."""
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def sqlalchemy_url(raw: str) -> str:
    """Railway가 주는 postgres(ql):// 주소에 psycopg 3 드라이버 이름을 붙인다."""
    for prefix in ("postgresql://", "postgres://"):
        if raw.startswith(prefix):
            return "postgresql+psycopg://" + raw[len(prefix):]
    return raw
