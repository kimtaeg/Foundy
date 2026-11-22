import type { BooleanProfileField, EditableProfileField } from "@/types/profile";

export const profileFieldLabels: Record<EditableProfileField, string> = {
  accountName: "계정 이름",
  name: "가게 이름",
  type: "업종",
  address: "가게 주소",
  detail: "층·호",
  region: "관심 지역",
  opening: "개업 예정일",
  birth: "출생 연도",
  area: "영업장 면적(㎡)",
  alcohol: "주류 판매",
  terrace: "테라스·옥외 공간 사용",
  employees: "직원 고용",
  funds: "준비 자금",
};

export function isEditableProfileField(field?: string): field is EditableProfileField {
  return field !== undefined && Object.prototype.hasOwnProperty.call(profileFieldLabels, field);
}

export function isBooleanProfileField(field?: string): field is BooleanProfileField {
  return field === "alcohol" || field === "terrace" || field === "employees";
}
