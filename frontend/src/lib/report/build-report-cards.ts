import { type Store } from "@/types/store";

/** Pure report evaluation. It never mutates persisted store state. */
export function buildCards(S: Store): any {
  const name: any = S.name,
    alc: any = S.alcohol;
  const list: any = [];
  list.push({
    id: "r-01",
    check: "building_use",
    decisionTask: "영업 방식 정하기",
    stage: "계약 전",
    contact: "build",
    base: alc ? "high" : "ok",
    by: "rule",
    title: alc
      ? "술을 팔 수 있는 자리인지 확인하세요"
      : "이 자리에서 휴게음식점으로 신고할 수 있는지 확인하세요",
    reason: alc
      ? "건축물대장에서 영업할 층의 용도를 확인하고, 일반음식점으로 신고할 수 있는지 구청에 문의하세요."
      : "건축물대장에서 영업할 층의 용도를 확인하고, 카페 영업이 가능한지 구청에 문의하세요.",
    consequence: alc
      ? "이대로 계약하면 영업신고가 반려돼 보증금이 묶일 수 있어요."
      : "",
    options: alc
      ? [
          {
            id: "o-1",
            label: "술 빼고 카페로 시작",
            summary: "주류를 메뉴에서 빼고 휴게음식점으로 신고를 준비해요.",
            time: ["즉시", "rule"],
            cost: ["추가 비용 없음", "rule"],
            fx: {
              verdict: "ok",
              resolved: "술 없이 카페로 시작하기로 했어요",
              alcohol: false,
              changes: [
                "업종 변경: 일반음식점 → 휴게음식점 (주류 판매 안 함, 규칙)",
                "체크리스트 변경: “영업신고” 항목이 휴게음식점 기준으로 바뀜",
                "재분석: 건물 용도 점검 위반 소지 높음 → 문제 없음",
              ],
            },
            action: {
              type: "decide",
              text: "메뉴에서 주류를 빼기로 확정하기",
              min: 3,
            },
          },
          {
            id: "o-2",
            label: "용도변경 신청",
            summary: "구청 승인과 건물주 동의가 필요해요.",
            time: ["확인 필요", null],
            cost: ["확인 필요", null],
            fx: {
              verdict: "high",
              addTask: "x-1",
              changes: [
                "체크리스트에 추가: 구청 건축과에 용도변경 가능 여부 문의",
                "재분석: 위반 소지 높음 유지 — 구청 답변 후 다시 판단",
              ],
            },
          },
          {
            id: "o-3",
            label: "다른 자리를 알아보기",
            summary:
              "계약 전이라면 용도가 맞는 다른 자리에서 시작할 수 있어요. 새 주소를 정하면 마이페이지에서 바꿔 점검을 다시 돌려요.",
            time: ["확인 필요", null],
            cost: ["확인 필요", null],
            fx: {
              verdict: "high",
              addTask: "x-0",
              changes: [
                "체크리스트에 추가: 용도가 맞는 다른 후보 자리 알아보기",
                "이 자리의 점검은 위반 소지 높음으로 유지돼요",
                "새 주소를 정하면 마이페이지에서 주소를 바꿔 다시 점검하세요",
              ],
            },
            action: {
              type: "decide",
              text: "다른 후보 자리를 정해 마이페이지에서 주소 바꾸기",
              min: 30,
              go: { page: "mypage", label: "마이페이지 열기" },
            },
          },
        ]
      : [],
    rec: alc
      ? {
          id: "o-3",
          reason:
            "①은 주류 매출을 포기해야 하고, ②는 개업일 안에 끝난다는 보장이 없어요. 계약 전이라면 용도가 맞는 자리를 다시 알아보는 쪽이 가장 안전해요.",
        }
      : null,
    action: alc
      ? {
          type: "send",
          text: "구청 건축과에 전화로 문의하기",
          min: 3,
        }
      : null,
    evidence: [
      {
        kind: "data",
        source: "건축물대장 층별개요",
        value: "영업할 층의 용도",
      },
      {
        kind: "law",
        source: "건축법 시행령",
        value: "용도별 건축물의 종류",
        url: "https://www.law.go.kr/",
      },
    ],
  });
  list.push({
    id: "r-02",
    check: "trademark_similar",
    decisionTask: "가게 이름을 바꿀지 정하기",
    stage: "계약 전",
    base: "low",
    by: "ai",
    title: "“" + name + "”와 비슷한 등록 상표가 있는지 확인하세요",
    reason:
      "같은 서비스 분류에서 발음이 비슷한 등록 상표를 찾아보세요.",
    consequence:
      "간판을 단 뒤 상표권자가 문제 삼으면 간판과 메뉴판을 바꿔야 할 수 있어요.",
    options: [
      {
        id: "o-1",
        label: "이름 바꾸기",
        summary: "새 이름 후보로 모노로스터스와 모노하우스가 있어요.",
        time: ["즉시", "rule"],
        cost: ["간판 제작 전이면 추가 비용 없음", "rule"],
        fx: {
          verdict: "ok",
          resolved: "가게 이름을 모노로스터스로 바꿨어요",
          name: "모노로스터스",
          changes: [
            "가게 이름: " + name + " → 모노로스터스",
            "재분석: 상표 점검 확인 권장 → 문제 없음",
          ],
        },
        action: {
          type: "decide",
          text: "새 이름 후보 중 하나 정하기",
          min: 5,
        },
      },
      {
        id: "o-2",
        label: "그대로 진행",
        summary: "위험을 알고 진행합니다.",
        time: ["즉시", "rule"],
        cost: ["확인 필요", null],
        fx: {
          verdict: "low",
          addTask: "x-2",
          changes: [
            "위험을 알고 진행하는 것으로 기록",
            "체크리스트에 추가: 간판 제작 전 상표 최종 확인",
          ],
        },
      },
    ],
    rec: {
      id: "o-1",
      reason: "간판을 만들기 전이라 지금 바꾸는 비용이 가장 낮아요.",
    },
    action: { type: "decide", text: "이름을 바꿀지 정하기", min: 3 },
    evidence: [
      {
        kind: "data",
        source: "KIPRIS 상표 검색",
        value: "같은 서비스 분류의 유사 상표",
        url: "https://www.kipris.or.kr/",
      },
    ],
  });
  list.push({
    id: "r-03",
    check: "building_violation",
    stage: "계약 전",
    contact: "build",
    base: "unknown",
    by: "rule",
    title: "위반건축물인지 확인할 수 없어요",
    reason: "건축물대장 표제부에서 위반건축물 표기를 확인하세요.",
    consequence: "위반건축물이면 영업신고가 반려될 수 있어요.",
    options: [],
    rec: null,
    action: {
      type: "send",
      text: "구청 건축과에 전화로 문의하기",
      min: 3,
    },
    evidence: [
      {
        kind: "data",
        source: "건축물대장 표제부",
        value: "위반건축물 표기 여부",
      },
    ],
  });
  list.push({
    id: "r-04",
    check: "permit_docs",
    stage: "개업 전",
    contact: "hyg",
    base: "low",
    by: "ai",
    title: "영업신고 서류를 개업 전에 준비해야 해요",
    reason: "영업 형태에 따라 위생교육 수료와 건강진단 등이 요구될 수 있어요.",
    consequence: "서류가 준비되지 않으면 신고 일정이 지연될 수 있어요.",
    options: [],
    rec: null,
    action: {
      type: "sign",
      text: "영업신고서 확인·서명하기",
      min: 10,
    },
    evidence: [
      {
        kind: "law",
        source: "식품위생법",
        value: "영업 신고 관련 규정",
        url: "https://www.law.go.kr/",
      },
    ],
  });
  list.push({
    id: "r-05",
    check: "labeling",
    stage: "운영 중",
    base: "ok",
    by: "rule",
    title: "기본 표시 의무 점검 항목",
    reason: "운영 중 지켜야 할 표시 의무를 확인하세요.",
    consequence: "",
    options: [],
    rec: null,
    action: null,
    evidence: [],
  });
  return list;
}
