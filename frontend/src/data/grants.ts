import { type Grant, type GrantResultLabels } from "@/types/grants";

/** Demonstration grant catalog; not live eligibility data. */
const EXAMPLE_GRANTS: Grant[] = [
  {
    id: "g1",
    title: "청년 예비창업자 사업화 지원 (예시 공고)",
    org: "K-Startup · 예시",
    cat: "사업화",
    region: "전국",
    amount: "최대 1,500만원",
    deadline: "2027-01-31",
    res: "partial",
    hue: ["#fafafa", "#f5f5f5"],
    who: "만 39세 이하 예비·초기 창업자",
    how: "사업화 자금 최대 1,500만원 (공고 확인 필요)",
    submit: ["사업계획서", "신분증 사본"],
    checks: [
      ["연령 조건 (만 39세 이하)", "pass", "“만 39세 이하 예비·초기 창업자”"],
      ["업력 조건 (창업 3년 이내)", "pass", "“창업 3년 이내”"],
      ["지역 조건", "unknown", "공고문에서 지역 조건을 확인하지 못했어요"],
    ],
  },
  {
    id: "g2",
    title: "청년 소상공인 점포 임차 지원 (예시 공고)",
    org: "서울시 · 예시",
    cat: "공간",
    region: "서울",
    amount: "임차료 월 최대 50만원",
    deadline: "2027-02-14",
    res: "eligible",
    hue: ["#fafafa", "#f5f5f5"],
    who: "서울 소재 점포를 여는 만 39세 이하 청년",
    how: "점포 임차료를 6개월간 지원 (공고 확인 필요)",
    submit: ["임대차계약서", "사업자등록증"],
    checks: [
      ["연령 조건", "pass", "“만 39세 이하 청년”"],
      ["지역 조건 (서울 소재)", "pass", "“서울 소재 점포”"],
      ["업종 조건 (음식업)", "pass", "“음식업·소매업”"],
    ],
  },
  {
    id: "g3",
    title: "청년 창업 저금리 융자 (예시 공고)",
    org: "소상공인시장진흥공단 · 예시",
    cat: "융자",
    region: "전국",
    amount: "최대 5천만원 · 금리는 공고 확인",
    deadline: "2027-03-31",
    res: "partial",
    hue: ["#fafafa", "#f5f5f5"],
    who: "업력 3년 미만 청년 소상공인",
    how: "운영 자금 융자 (한도·금리는 공고 확인 필요)",
    submit: ["사업자등록증", "자금 사용 계획서"],
    checks: [
      ["연령 조건", "pass", "“만 39세 이하”"],
      ["업력 조건", "pass", "“업력 3년 미만”"],
      ["자금 사용 계획", "unknown", "제출 서류 기준을 확인하지 못했어요"],
    ],
  },
  {
    id: "g4",
    title: "창업 기초 교육 과정 (예시 공고)",
    org: "창업진흥원 · 예시",
    cat: "교육",
    region: "전국",
    amount: "교육비 전액 지원",
    deadline: "2026-12-20",
    res: "eligible",
    hue: ["#fafafa", "#f5f5f5"],
    who: "예비 창업자 누구나",
    how: "4주 온라인 교육, 수료증 발급",
    submit: ["온라인 신청서"],
    checks: [["대상 조건 (예비 창업자)", "pass", "“예비 창업자 누구나”"]],
  },
  {
    id: "g5",
    title: "지역 소상공인 창업 준비 멘토링 (예시 공고)",
    org: "성동구 · 예시",
    cat: "멘토링",
    region: "서울 성동구",
    amount: "멘토링 6회",
    deadline: null,
    res: "unknown",
    hue: ["#fafafa", "#f5f5f5"],
    who: "성동구 사업장 소재 예정자",
    how: "전문가 멘토링 6회 (일정 미정)",
    submit: ["신청서"],
    checks: [["사업장 소재지", "unknown", "공고에 소재지 기준 시점이 없어요"]],
  },
];

/** Demonstration grant catalog; not live eligibility data. */
export const GRANTS: Grant[] = EXAMPLE_GRANTS.map((grant) => ({ ...grant, example: true }));

export const GRANT_EXCLUDED = 3;

export const RES: GrantResultLabels = {
  eligible: ["신청 가능성 높음", "ok"],
  partial: ["일부 확인 필요", "low"],
  unknown: ["판단 불가", "unknown"],
};
