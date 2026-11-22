import type { Grant } from "@/types/grants";

export function grantSourceLabel(value = "") {
  return value.trim().replace(/(?:^|\s*·\s*)(?:예시(?: 공고| 데이터)?|모의 응답|데모 데이터)(?:\s*·\s*실제 조회 아님)?$/, "").trim();
}

export function grantDisplay({ title, org }: Pick<Grant, "title" | "org">) {
  return {
    title: title.replace(/\s*\(예시 공고\)\s*$/, ""),
    org: grantSourceLabel(org),
  };
}
