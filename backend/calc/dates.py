"""개업일 역산 계산 (계산 도구). AI는 날짜를 직접 계산하지 않는다.

- 기본 체크리스트 항목: 개업일 + offset_days (시기 group_label은 규칙 묶음이 항목마다 정한다)
- 지원사업 마감처럼 날짜가 이미 정해진 항목: dday로 시기를 나눈다
"""

from __future__ import annotations

from datetime import date, timedelta


def group_for_dday(dday: int) -> str:
    """지원사업 마감 항목의 시기. -29 이하 계약 전, -28~-15 개업 4주 전, -14~-1 개업 직전, 0 이상 개업 후."""
    if dday <= -29:
        return "계약 전"
    if dday <= -15:
        return "개업 4주 전"
    if dday < 0:
        return "개업 직전"
    return "개업 후"


def checklist_dates(opening_date: date, offset_days: int) -> dict:
    """{"due_date", "dday"}: due_date = 개업일 + offset_days, dday = offset_days (개업일 기준 일수)."""
    return {"due_date": opening_date + timedelta(days=offset_days), "dday": offset_days}


def date_info(opening_date: date, due_date: date) -> dict:
    dday = (due_date - opening_date).days
    return {"due_date": due_date, "dday": dday, "group_label": group_for_dday(dday)}


class Dates:
    """Calc Protocol(agent/ports.py)을 만족하는 구현."""

    checklist_dates = staticmethod(checklist_dates)
    date_info = staticmethod(date_info)
