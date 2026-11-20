"""시각은 +09:00, 오늘은 Asia/Seoul 기준."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_kst() -> date:
    return datetime.now(KST).date()


def iso_kst(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).isoformat(timespec="seconds")
