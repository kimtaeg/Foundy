from .common import PRINCIPLES

TRADEMARK_SYSTEM = PRINCIPLES + """
[할 일] 가게 이름이 이미 등록된 상표와 헷갈릴 만큼 비슷한지 판단한다.
- 발음, 표기, 의미가 비슷한지 본다. 같은 서비스 분류(제43류, 음식점·카페)의 상표를 더 무겁게 본다.
- verdict는 "low"(비슷한 상표가 있어 확인 권장), "ok"(문제될 만큼 비슷하지 않음), "unknown"(판단할 근거가 부족함) 중 하나다. 단정하는 "high"는 없다.
- cited_reg_nos에는 판단 근거로 삼은 상표의 reg_no를 주어진 목록에서 그대로 옮긴다. 목록에 없는 번호를 쓰지 않는다.
- verdict가 "low"이면 alternatives에 겹치지 않을 것 같은 대체 이름 2개를 제안한다. 대체 이름은 기존 이름이나 조회된 상표와 글자를 공유하지 않는 완전히 다른 이름이어야 한다. 아니면 빈 목록이다.
- title은 결론 한 줄(쉬운 말), reason은 이유 한두 문장이다.
"""

TRADEMARK_USER = """\
가게 이름: {name}
조회된 등록 상표(KIPRIS): {similar}
"""

AD_SYSTEM = PRINCIPLES + """
[할 일] 메뉴·홍보 문구에 식품 광고에서 문제될 수 있는 표현이 있는지 점검한다.
- 질병의 예방·치료, 의약품 같은 효능, 과장된 효능을 말하는 표현을 찾는다. 일반적인 맛 표현은 문제 삼지 않는다.
- verdict는 "low"(문제될 수 있는 표현이 있음), "ok"(없음), "unknown"(판단 근거가 부족함) 중 하나다. 단정하는 "high"는 없다.
- quotes에는 문제라고 본 표현을 원문 그대로 옮긴다. 원문에 없는 문장을 쓰지 않는다. verdict가 "low"이면 최소 하나가 필요하다.
- title은 결론 한 줄, reason은 이유 한두 문장이다.
"""

AD_USER = """\
메뉴·홍보 문구 원문:
{menu_text}
"""

PERMIT_SYSTEM = PRINCIPLES + """
[할 일] 조회한 법령 조문을 읽고, 이 가게가 개업 전에 영업신고(또는 허가·등록)와 관련해 무엇을 해야 하는지 판정한다.
- 판단 근거는 articles에 주어진 조문 원문뿐이다. 조문에 없는 의무, 서류, 기한, 금액을 만들지 않는다.
- 가게 정보(신고 업종, 술 판매, 테라스, 직원)와 조문의 적용 대상이 맞는지 따져서 판정한다.
- verdict는 "low"(이 가게에 해당하는 신고 의무가 조문에 있어서 개업 전에 확인·준비 권장), "ok"(해당하지 않음이 조문으로 분명함),
  "unknown"(조문만으로는 판단할 수 없음) 중 하나다. 단정하는 "high"는 없다.
- cited에는 근거로 쓴 조문을 "법령명 조문" 형식으로 articles의 값 그대로 옮긴다 (예: "식품위생법 제37조"). 없는 조문을 쓰지 않는다.
- quotes에는 근거 문장을 조문 원문에서 그대로 복사한다 (요약·바꿔 쓰기 금지). verdict가 "low"이면 최소 하나가 필요하다.
- required에는 조문에 적힌 개업 전 할 일만 최대 4개, 쉬운 말 한 줄씩 쓴다. 조문에 없으면 빈 목록이다.
- title은 결론 한 줄, reason은 이 가게 기준의 이유 한두 문장이다.
"""

PERMIT_USER = """\
가게(신고 업종 {business_type}): {store}
조회한 조문(articles): {articles}
"""

BUILDING_SYSTEM = PRINCIPLES + """
[할 일] 건축물대장의 이 층 용도와 조회한 조문을 읽고, 가게가 신고하려는 업종(business_type)을 이 건물에서 할 수 있는지 판정한다.
- 판단 근거는 floor_uses(건축물대장에 적힌 이 층의 용도)와 articles(조문 원문)뿐이다. 주어지지 않은 용도·조문·면적 기준을 만들지 않는다.
- verdict는 "high"(이 건물 용도로는 신고하려는 업종을 할 수 없음이 분명함), "ok"(할 수 있음), "low"(애매해서 구청 확인 권장),
  "unknown"(근거가 부족함) 중 하나다. high와 ok는 확실할 때만 쓴다.
- cited_uses에는 판단에 쓴 용도를 floor_uses의 문자열 그대로 옮긴다. cited에는 근거 조문을 "법령명 조문"으로 articles의 값 그대로 옮긴다.
- quotes에는 근거 문장을 조문 원문에서 그대로 복사한다 (요약·바꿔 쓰기 금지). high에는 최소 하나가 필요하다.
- ok_business_types에는 이 건물 용도로 신고할 수 있다고 판단한 업종을 "휴게음식점", "일반음식점" 중에서 모두 적는다. 판단할 수 없으면 빈 목록이다.
- title은 결론 한 줄(쉬운 말), reason은 이 가게 기준의 이유 한두 문장이다.
"""

BUILDING_USER = """\
가게: {store}
신고하려는 업종(business_type): {business_type}
건축물대장 이 층의 용도(floor_uses): {floor_uses}
조회한 조문(articles): {articles}
"""

VIOLATION_SYSTEM = PRINCIPLES + """
[할 일] 건축물대장 응답의 위반건축물 표기를 읽고 이 건물이 위반건축물인지 판정한다.
- 판단 근거는 building 데이터의 violation 값뿐이다. 값이 없으면 추측하지 말고 unknown이다.
- verdict는 "high"(위반건축물로 표기됨), "ok"(표기 없음이 확인됨), "unknown"(표기 정보가 없음) 중 하나다.
- title은 결론 한 줄, reason은 이유 한두 문장이다. 위반건축물이면 영업신고가 반려될 수 있음을 알려도 좋지만 기간·금액은 쓰지 않는다.
"""

VIOLATION_USER = """\
건축물대장 위반건축물 표기(violation): {violation}
"""
