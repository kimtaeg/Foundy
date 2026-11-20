"""알림 시점 이동(as_of) 예시 알림 (API 명세서 12장, DB 명세서 2-6).

저장하지 않는다. 응답할 때 체크리스트 상태와 mocks/alerts_as_of.json 으로 만들고 is_example: true 를 붙인다.
- 기한 알림: as_of 기준으로 기한이 지났거나 14일 이내인 미완료 체크리스트 항목 (숨긴 카테고리 제외)
- 개업 후 알림: 개업일에서 달력상 N개월이 지난 as_of 이면 mock 알림 (부가세·위생교육 갱신 확인)
"""

import calendar
import json
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

from services.timeutil import KST, iso_kst

MOCK = Path(__file__).resolve().parents[1] / "mocks" / "alerts_as_of.json"
DEADLINE_WINDOW_DAYS = 14


def add_months(start: date, months: int) -> date:
    """달력상 N개월 뒤. 그 달에 같은 날짜가 없으면 말일 (8/31 + 6개월 → 2/28 또는 2/29)."""
    index = start.month - 1 + months
    year, month = start.year + index // 12, index % 12 + 1
    return date(year, month, min(start.day, calendar.monthrange(year, month)[1]))


@lru_cache
def _mock_items() -> tuple[dict, ...]:
    return tuple(json.loads(MOCK.read_text(encoding="utf-8"))["items"])


def _created_at(as_of: date) -> str:
    return iso_kst(datetime.combine(as_of, time(9, 0), tzinfo=KST))


def _example(alert_id: str, type_: str, title: str, body: str, cta: dict, as_of: date) -> dict:
    return {"alert_id": alert_id, "type": type_, "title": title, "body": body, "cta": cta, "diff": None,
            "is_example": True, "read": False, "created_at": _created_at(as_of)}


def deadline_alerts(items: list[Any], as_of: date, hidden_categories: set[str], title_of) -> list[dict]:
    """기한이 지났거나 as_of + 14일 이내인 미완료 항목. 기한이 이른 것부터."""
    limit = as_of + timedelta(days=DEADLINE_WINDOW_DAYS)
    rows = sorted((i for i in items if not i.done and i.category not in hidden_categories and i.due_date <= limit),
                  key=lambda i: (i.due_date, i.item_key))
    out = []
    for item in rows:
        days = (item.due_date - as_of).days
        when = f"기한 {-days}일 지남" if days < 0 else ("오늘 마감" if days == 0 else f"D-{days}")
        body = f"기한 {item.due_date.isoformat()}"
        if item.agency:
            body += f" · {item.agency}"
        out.append(_example(f"ex-dl-{item.item_key}", "deadline", f"“{title_of(item)}” {when}", body,
                            {"label": "체크리스트 열기", "page": "checklist", "item_id": item.item_key}, as_of))
    return out


def after_opening_alerts(opening_date: date, as_of: date) -> list[dict]:
    return [_example(f"ex-{m['key']}", m["type"], m["title"], m["body"], dict(m["cta"]), as_of)
            for m in _mock_items() if as_of >= add_months(opening_date, m["months_after_opening"])]


def example_alerts(items: list[Any], opening_date: date, as_of: date, hidden_categories: set[str], title_of) -> list[dict]:
    return deadline_alerts(items, as_of, hidden_categories, title_of) + after_opening_alerts(opening_date, as_of)
