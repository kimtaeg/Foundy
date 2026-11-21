import type { DocFilter, DocumentSite, ManagedDocumentStatus, TaskDocument } from "@/types/documents";

/** 서류를 받는 공식 사이트. 링크는 사이트 첫 화면이며 찾는 방법은 안내 문구에 적는다. */
export const DOCUMENT_SITES: Record<string, DocumentSite> = {
  gov: { label: "정부24", url: "https://www.gov.kr/" },
  hometax: { label: "홈택스", url: "https://www.hometax.go.kr/" },
  eais: { label: "세움터 (건축행정시스템)", url: "https://www.eais.go.kr/" },
  kipris: {
    label: "KIPRIS (특허정보검색서비스)",
    url: "https://www.kipris.or.kr/",
  },
  moel: { label: "고용노동부", url: "https://www.moel.go.kr/" },
  insure: {
    label: "4대사회보험 정보연계센터",
    url: "https://www.4insure.or.kr/",
  },
  naqs: { label: "국립농산물품질관리원", url: "https://www.naqs.go.kr/" },
};

/** 체크리스트 항목 id별로 받아야 하는 서류. 직접 만들어 주는 서류는 두지 않는다. */
export const TASK_DOCUMENTS: Record<string, TaskDocument[]> = {
  "c-01": [
    {
      id: "bldg",
      name: "건축물대장 (일반·집합)",
      agency: "정부24 · 세움터",
      guide:
        "정부24에서 “건축물대장 열람/발급”을 검색하거나, 세움터의 건축물대장 발급·열람 메뉴에서 주소로 조회해요",
      sites: ["gov", "eais"],
    },
  ],
  "c-02": [
    {
      id: "tm",
      name: "상표 검색 결과",
      agency: "KIPRIS",
      guide:
        "KIPRIS에서 상표 검색 → 가게 이름을 넣고 유사 상표의 지정 서비스(제43류)를 확인해요",
      sites: ["kipris"],
    },
  ],
  "c-03": [
    {
      id: "bizapply",
      name: "사업자등록 신청",
      agency: "홈택스",
      guide:
        "홈택스 로그인 → 신청/제출 → 사업자등록 신청 (영업신고증 사본 첨부)",
      sites: ["hometax"],
    },
  ],
  "c-04": [
    {
      id: "apply",
      name: "영업신고 접수",
      agency: "정부24 · 관할 구청 위생과",
      guide:
        "정부24에서 “영업신고”를 검색해 신청하거나, 관할 구청 위생과에 직접 제출해요. 신고 업종과 필요 서류는 구청에 먼저 확인하세요",
      sites: ["gov"],
    },
  ],
  "c-07": [
    {
      id: "signapply",
      name: "옥외광고물 신고·허가 안내",
      agency: "정부24 · 관할 구청",
      guide:
        "정부24에서 “옥외광고물”을 검색하고, 신고·허가 대상인지 관할 구청에 확인하세요",
      sites: ["gov"],
    },
  ],
  "c-08": [
    {
      id: "contract",
      name: "표준 근로계약서 양식",
      agency: "고용노동부",
      guide:
        "고용노동부 누리집의 자료실·정책자료에서 “표준근로계약서”를 찾아 받아요",
      sites: ["moel"],
    },
    {
      id: "insure",
      name: "4대보험 취득 신고",
      agency: "4대사회보험 정보연계센터",
      guide: "근로자를 고용하면 4대사회보험 정보연계센터에서 취득 신고를 해요",
      sites: ["insure"],
    },
  ],
  "c-09": [
    {
      id: "label",
      name: "원산지·가격 표시 안내",
      agency: "국립농산물품질관리원",
      guide: "원산지 표시 대상과 방법은 국립농산물품질관리원 안내를 확인하세요",
      sites: ["naqs"],
    },
  ],
  "x-0": [
    {
      id: "bldg0",
      name: "후보 자리 건축물대장",
      agency: "정부24 · 세움터",
      guide: "후보 주소의 건축물대장에서 해당 층 용도를 확인해요",
      sites: ["gov", "eais"],
    },
  ],
  "x-2": [
    {
      id: "tm2",
      name: "상표 최종 확인",
      agency: "KIPRIS",
      guide: "간판 제작 전에 KIPRIS에서 다시 검색해요",
      sites: ["kipris"],
    },
  ],
};

export function documentsOf(taskId: string): TaskDocument[] {
  return TASK_DOCUMENTS[taskId] ?? [];
}

/** 서류 상태 선택지. 발급·취득 완료와 제출 완료는 다르다 (발급받았다고 제출한 것은 아니다). */
export const DOC_STATUS_OPTIONS: { value: ManagedDocumentStatus; label: string }[] = [
  { value: "not_started", label: "준비 전" },
  { value: "in_progress", label: "준비 중" },
  { value: "obtained", label: "발급·취득 완료" },
  { value: "submitted", label: "제출 완료" },
  { value: "needs_fix", label: "보완 필요" },
  { value: "not_applicable", label: "해당 없음" },
];

export const DOC_FILTERS: { value: DocFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "todo", label: "준비 전" },
  { value: "doing", label: "준비 중" },
  { value: "fix", label: "보완 필요" },
  { value: "done", label: "완료" },
];

/** 상태가 보기에 속하는지. 해당 없음은 "전체"에서만 보인다. */
export const DOC_FILTER_MATCH: Record<DocFilter, (status: ManagedDocumentStatus) => boolean> = {
  all: () => true,
  todo: (status) => status === "not_started",
  doing: (status) => status === "in_progress",
  fix: (status) => status === "needs_fix",
  done: (status) => status === "obtained" || status === "submitted",
};
