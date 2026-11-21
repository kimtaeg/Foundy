/** Checklist categories, scheduling offsets, and report dependencies. */
export const CATCOLOR: any = {
  "영업 인허가": "#107e7d",
  세무: "#404040",
  고용: "#737373",
  "건물·시설": "#525252",
  "간판·광고": "#a3a3a3",
  "표시 의무": "#171717",
  정책: "#0c6564",
};

export const X_DEFS: any = {
  "x-0": {
    task: "용도가 맞는 다른 후보 자리 알아보기",
    category: "건물·시설",
    group: "계약 전",
    off: -70,
    documents: "건축물대장(후보 자리)",
    agency: "본인 확인",
  },
  "x-1": {
    task: "구청 건축과에 용도변경 가능 여부 문의",
    category: "건물·시설",
    group: "계약 전",
    off: -60,
    documents: "건축물대장",
    agency: "관할 구청 건축과",
  },
  "x-2": {
    task: "간판 제작 전 상표 최종 확인 (KIPRIS)",
    category: "간판·광고",
    group: "계약 전",
    off: -30,
    documents: "상표 검색 결과",
    agency: "KIPRIS",
  },
};

export const OFFS: any = [-56, -49, -28, -28, -22, -10, -6, -3, 7];

export const GROUPS: any = ["계약 전", "개업 4주 전", "개업 직전", "개업 후"];

export const TASK_LINKS: any = {
  "c-01": ["r-01", "r-03"],
  "c-02": ["r-02"],
  "c-04": ["r-04"],
  "x-0": ["r-01"],
  "x-1": ["r-01"],
  "x-2": ["r-02"],
};
