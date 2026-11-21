/** 마이페이지 수정(변경 목록) → PATCH /api/stores/{id} 요청 본문. 서버가 모르는 항목(관심 지역·자리 상태)은 로컬에서만 처리한다. */
export interface ProfileChange {
  k: string;
  from: unknown;
  to: unknown;
}

const TOP_LEVEL: Record<string, string> = {
  name: "name",
  type: "business_type_input",
  address: "address",
  detail: "address_detail",
  opening: "opening_date",
  birth: "owner_birth_year",
};
const ANSWERS: Record<string, string> = {
  alcohol: "sells_alcohol",
  terrace: "uses_terrace",
  employees: "has_employees",
  funds: "funds_krw",
};

export const canPatchOnServer = (diff: ProfileChange[]) =>
  diff.length > 0 && diff.every((change) => change.k in TOP_LEVEL || change.k in ANSWERS);

const text = (value: unknown) => String(value ?? "").trim();
const numberOrNull = (value: unknown) => (text(value) === "" ? null : Number(value) || null);

export function toStorePatch(diff: ProfileChange[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const answers: Record<string, unknown> = {};
  for (const { k, to } of diff) {
    if (k === "birth") body.owner_birth_year = numberOrNull(to);
    else if (k in TOP_LEVEL) body[TOP_LEVEL[k]] = text(to);
    else if (k === "funds") answers.funds_krw = numberOrNull(to);
    else if (k in ANSWERS) answers[ANSWERS[k]] = !!to;
  }
  if (Object.keys(answers).length) body.answers = answers;
  return body;
}
