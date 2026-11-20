"""AI가 만든 리포트 항목이 불변 규칙을 지키도록 강제하는 검증.

LLM 호출 없이 동작하며, 위반이면 항목을 조용히 고치고 바꾼 내용을 changes로 돌려준다.
(시연 중 근거 없는 판정이나 AI의 '위반 소지 높음'이 나가지 않게 하는 마지막 방어선)
"""

from __future__ import annotations

from .schemas import ReportItem


def enforce(
    item: ReportItem, allowed_remedies: list[str] | None = None, ai_high_allowed: bool = False,
) -> tuple[ReportItem, list[str]]:
    """불변 규칙을 적용한 항목과 바꾼 내용 목록을 돌려준다.

    1. 근거가 없으면 verdict는 unknown (ok·안내 항목 포함, 예외 없음)
    2. AI가 판정한 항목은 high가 될 수 없다 → low. 규칙 묶음이 ai_high_allowed로 허용한 항목(건물 용도·위반건축물)만 예외이고,
       그 항목은 판정 단계에서 근거 검증과 규칙표 대조를 통과해야 high다
    3. allowed_remedies가 주어지면 그 밖의 대응 유형 선택지는 제거 (remedy가 비어 있는 선택지도 제거)
    4. 추천은 실제로 남아 있는 선택지를 가리켜야 한다
    """
    changes: list[str] = []
    update: dict = {}

    if not item.evidence and item.verdict != "unknown":
        update["verdict"] = "unknown"
        changes.append(f"근거 없음: {item.verdict} → unknown")
    verdict = update.get("verdict", item.verdict)

    if item.decided_by == "ai" and verdict == "high" and not ai_high_allowed:
        update["verdict"] = "low"
        changes.append("AI 판정은 high 불가: high → low")

    options = item.options
    if allowed_remedies is not None:
        kept = [o for o in options if o.remedy in allowed_remedies]
        if len(kept) != len(options):
            changes.append(f"허용되지 않은 선택지 {len(options) - len(kept)}개 제거")
            options = kept
            update["options"] = options

    if item.recommendation and item.recommendation.option_id not in {o.option_id for o in options}:
        update["recommendation"] = None
        changes.append("추천이 없는 선택지를 가리켜 제거")

    return (item.model_copy(update=update) if update else item), changes
