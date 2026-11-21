/** 마이페이지 가게 정보 수정 (서버 연결 모드). GET /api/stores/{id} 의 저장값으로 폼을 만들고, 사용자가 바꾼 필드만
 * PATCH /api/stores/{id} 요청 본문으로 만든다. 같은 본문을 미리보기(?dry_run=true)와 실제 저장에 쓴다.
 *
 * - 폼 기준값은 저장된 원본값(answers)이다. 카드 선택이 적용된 유효 값(effective)은 안내로만 보여 주고 요청에 섞지 않는다.
 * - 생략 = 그대로, false = false 로 저장, 출생 연도·면적·자금을 비우면 null. 예/아니요 항목은 null 을 보내지 않는다(미답변 유지).
 */
import type { ApiPatchResult, ApiStore } from "@/lib/api/types";

export interface ServerForm {
  name: string;
  type: string;
  address: string;
  detail: string;
  opening: string;
  birth: string;
  area: string;
  funds: string;
  alcohol: boolean | null;
  terrace: boolean | null;
  employees: boolean | null;
  delivery: boolean | null;
}

export type ServerFormKey = keyof ServerForm;
export const BOOLEAN_KEYS = ["alcohol", "terrace", "employees", "delivery"] as const;
export const TEXT_KEYS = ["name", "type", "address", "detail", "opening", "birth", "area", "funds"] as const;

const numberText = (value: number | null | undefined) => (value == null ? "" : String(value));

/** 저장된 원본값으로 폼 기준값을 만든다 (유효 값이 아니다). */
export function formFromStore(store: ApiStore): ServerForm {
  const answers = store.answers;
  return {
    name: store.name ?? "",
    type: store.business_type_input ?? "",
    address: store.address ?? "",
    detail: store.address_detail ?? "",
    opening: store.opening_date ?? "",
    birth: numberText(store.owner_birth_year),
    area: numberText(answers.area_sqm),
    funds: numberText(answers.funds_krw),
    alcohol: answers.sells_alcohol ?? null,
    terrace: answers.uses_terrace ?? null,
    employees: answers.has_employees ?? null,
    delivery: answers.does_delivery ?? null,
  };
}

/** 카드 선택으로 저장값과 다르게 적용 중인 값 (화면 안내용). */
export function effectiveNotes(store: ApiStore): Partial<Record<ServerFormKey, string>> {
  const notes: Partial<Record<ServerFormKey, string>> = {};
  const yesNo = (value: boolean | null) => (value == null ? "미답변" : value ? "예" : "아니요");
  const raw = store.answers.sells_alcohol ?? null;
  const effective = store.effective?.answers?.sells_alcohol ?? null;
  if (effective !== raw) notes.alcohol = `카드 선택으로 지금 적용 중인 값: ${yesNo(effective)} (저장값 ${yesNo(raw)})`;
  return notes;
}

const trim = (value: string) => value.trim();
const numberOrNull = (value: string) => {
  const text = value.trim();
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : text; // 숫자가 아니면 서버가 거절하도록 그대로 보낸다 (미리보기 실패로 보인다)
};

const TOP_TEXT: Partial<Record<ServerFormKey, string>> = {
  name: "name",
  type: "business_type_input",
  address: "address",
  detail: "address_detail",
  opening: "opening_date",
};
const ANSWER_BOOLEANS: Record<(typeof BOOLEAN_KEYS)[number], string> = {
  alcohol: "sells_alcohol",
  terrace: "uses_terrace",
  employees: "has_employees",
  delivery: "does_delivery",
};

/** 기준값과 다른 필드만 담은 PATCH 본문. 바뀐 것이 없으면 빈 객체. */
export function buildStorePatch(base: ServerForm, draft: ServerForm): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const answers: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(TOP_TEXT) as [ServerFormKey, string][]) {
    if (trim(String(base[key])) !== trim(String(draft[key]))) body[field] = trim(String(draft[key]));
  }
  if (numberOrNull(base.birth) !== numberOrNull(draft.birth)) body.owner_birth_year = numberOrNull(draft.birth);
  if (numberOrNull(base.area) !== numberOrNull(draft.area)) body.area_sqm = numberOrNull(draft.area);
  if (numberOrNull(base.funds) !== numberOrNull(draft.funds)) answers.funds_krw = numberOrNull(draft.funds);
  for (const key of BOOLEAN_KEYS) {
    const next = draft[key];
    if (next !== null && next !== base[key]) answers[ANSWER_BOOLEANS[key]] = next;
  }
  if (Object.keys(answers).length) body.answers = answers;
  return body;
}

/** 같은 내용이면 같은 문자열 (키 순서와 무관). 미리보기와 저장이 같은 변경인지 비교하는 데 쓴다. */
export function patchKey(patch: Record<string, unknown>): string {
  const sort = (value: unknown): unknown =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((k) => [k, sort((value as Record<string, unknown>)[k])]),
        )
      : value;
  return JSON.stringify(sort(patch));
}

/** 서버 응답의 API 필드 이름 → 화면 이름 (표시만 한다. 영향 계산은 서버가 한다). */
const FIELD_LABEL: Record<string, string> = {
  name: "가게 이름",
  business_type_input: "업종",
  address: "주소",
  address_detail: "층·호",
  opening_date: "개업 예정일",
  owner_birth_year: "출생 연도",
  area_sqm: "영업장 면적",
  sells_alcohol: "술 판매",
  uses_terrace: "테라스·옥외 공간",
  has_employees: "직원 고용",
  does_delivery: "배달 영업",
  funds_krw: "준비 자금",
};

const show = (value: unknown) =>
  value === true ? "예" : value === false ? "아니요" : value == null || value === "" ? "없음" : String(value);

/** 서버 미리보기·저장 응답의 변경 요약 줄 (바뀐 값 → 초기화되는 카드). */
export function previewLines(result: ApiPatchResult): string[] {
  const label = (field: string) => FIELD_LABEL[field] ?? FIELD_LABEL[field.replace(/^answers\./, "")] ?? field;
  const lines = result.changed.map((change) => `${label(change.field)}: ${show(change.from)} → ${show(change.to)}`);
  result.reset_items.forEach((item) =>
    lines.push(`“${item.title}” 카드${item.chosen_label ? `의 “${item.chosen_label}” 선택` : ""} 초기화 (다시 결정 대기)`),
  );
  return lines;
}
