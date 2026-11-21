import type { Category, PopType, ViewType } from "@/types/foot-traffic";

export const POP_TYPES: PopType[] = ["local", "fornLong", "fornTemp"];
export const TYPE_LABEL: Record<ViewType, string> = {
  all: "전체", local: "내국인", fornLong: "장기외국인", fornTemp: "단기외국인",
};
export const CATEGORY_LABEL: Record<Category, string> = {
  type: "전체", sex: "성별", age: "연령대",
};
export const SEX_GROUPS = [["male", "남성"], ["female", "여성"]] as const;
export const AGE_GROUPS = [
  ["a00", "10세 미만"], ["a10", "10대"], ["a20", "20대"], ["a30", "30대"],
  ["a40", "40대"], ["a50", "50대"], ["a60", "60대"], ["a70", "70세 이상"],
] as const;

export function filesFor(category: Category, sub: string): string[] {
  if (category === "type") return sub === "all" ? [...POP_TYPES] : [sub];
  return [`local-${sub}`];
}
