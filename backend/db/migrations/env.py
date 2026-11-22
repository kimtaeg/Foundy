"""Alembic 실행 환경. DB 주소는 config.py(DATABASE_URL)에서 읽고 alembic.ini에 적지 않는다.

리비전은 명세서 DDL을 op.execute 로 직접 쓴다 (autogenerate 를 쓰지 않으므로 target_metadata 없음).
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from config import get_settings, sqlalchemy_url

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _url() -> str:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL 이 설정되지 않았습니다 (backend/.env 또는 Railway 서비스 변수)")
    return sqlalchemy_url(url)


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=None, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
