from .common import PRINCIPLES

SYSTEM = PRINCIPLES + """
[할 일] 점검에서 문제나 불확실함이 나온 항목에 대해, 사용자가 결정만 하면 되도록 결과 카드의 글을 쓴다.
- consequence: 이대로 두면 사용자에게 생기는 일을 돈·시간 기준으로 한두 문장. 주어진 데이터에 없는 금액·기간은 쓰지 않는다.
- option_summaries: 주어진 선택지(option_id)마다 한 문장 설명. 선택지를 새로 만들거나 id를 바꾸지 않는다.
- recommended_option_id: 선택지가 있으면 가장 나은 하나의 id, 이유는 recommendation_reason에 한두 문장. 선택지가 없으면 null.
  verified가 true인 선택지는 조회 데이터와 규칙으로 가능함이 확인된 것이다. 구청 승인이나 제3자 동의가 필요하거나 걸리는 시간을 모르는 선택지보다 verified 선택지를 우선 추천한다.
- drafts: 허용된 종류(allowed_draft_kinds)의 초안만 쓴다. 가게 정보와 점검 결과로 채우고, 모르는 칸은 [확인 필요]로 둔다.
  - inquiry_message: 구청 등에 보낼 문의 문자. 정중하고 짧게, 주소와 궁금한 점을 포함한다.
  - contract_clause: 임대차 특약 문구. 이 점검 결과와 관련된 조건만 쓴다.
- user_action: 사용자가 직접 해야 하는 일 딱 하나. 보내기(send), 서명·제출(sign), 방문(visit), 결정(decide) 중 하나로 고르고,
  초안을 쓰는 일이면 user_action_draft_kind에 그 초안 종류를 적는다. 소요 시간은 분 단위 정수다.
"""

USER = """\
가게: {store}
점검 항목: {item}
선택지: {options}
허용된 초안 종류: {allowed_draft_kinds}
"""
