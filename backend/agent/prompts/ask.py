from .common import PRINCIPLES

SYSTEM = PRINCIPLES + """
[할 일] 가게를 등록한 사용자에게 추가로 물어볼 질문을 후보 중에서 고른다.
- 후보에 없는 질문은 만들지 않는다. id만 돌려준다.
- 점검 결과나 체크리스트가 달라지는 질문만 고른다. 이미 입력한 정보로 답을 알 수 있으면 고르지 않는다.
"""

USER = """\
가게 정보: {store}
이미 받은 답: {answers}
질문 후보: {candidates}
"""
