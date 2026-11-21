import { type Store } from "@/types/store";

/** Store defaults and the impact map used when profile fields change. */
export const EMPTY_STORE: Store = {
  name: "",
  type: "카페",
  address: "",
  detail: "",
  opening: "",
  birth: null,
  location: "decided",
  region: "",
  alcohol: false,
  terrace: false,
  employees: false,
  funds: null,
  area: null,
  delivery: false,
  mainManual: null,
  onboarded: false,
};

export const DEMO_STORE: Store = {
  name: "모노커피",
  type: "카페",
  address: "서울특별시 성동구 성수이로 00",
  detail: "1층",
  opening: "2027-03-02",
  birth: 1998,
  location: "decided",
  region: "서울 성동구 성수동",
  alcohol: true,
  terrace: false,
  employees: true,
  funds: 40000000,
  area: null,
  delivery: false,
  mainManual: null,
  onboarded: true,
};

export const MPF: any = {
  name: ["가게 이름", ["trademark"]],
  type: ["업종", ["building", "law", "checklist", "market"]],
  address: ["주소", ["building", "law", "checklist", "market"]],
  detail: ["층·호", ["building"]],
  region: ["관심 지역", ["market"]],
  opening: ["개업 예정일", ["dates"]],
  birth: ["출생 연도", ["grants"]],
  alcohol: ["술 판매", ["building", "law", "checklist"]],
  terrace: ["테라스·옥외 공간", ["law", "checklist"]],
  employees: ["직원 고용", ["checklist"]],
  funds: ["준비 자금", ["costs"]],
  area: ["영업장 면적", ["law", "checklist"]],
  delivery: ["배달 영업", ["law"]],
  location: ["자리 상태", []],
};

export const IMP: any = {
  dates: "체크리스트 날짜 다시 계산",
  trademark: "상표 유사 점검 다시",
  building: "건물 용도·위반건축물 점검 다시",
  law: "영업 신고 관련 법령 점검 다시",
  checklist: "개업 체크리스트 항목 다시 구성",
  grants: "지원사업 자격 다시 판정",
  market: "상권 분석 다시",
  costs: "비용 계산(준비 자금 기준) 다시",
  lock: "점검 리포트는 자리를 다시 정하면 이어서 열려요 (이전 결과는 보관)",
};

export const IMPCARDS: any = {
  building: ["r-01", "r-03"],
  law: ["r-01", "r-04"],
  trademark: ["r-02"],
};

export const REGIONS: any = [
  "서울 성동구 성수동",
  "서울 성동구 송정동",
  "서울 마포구 연남동",
];
