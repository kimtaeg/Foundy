import { type ReportOption } from "@/types/report";

/** 기간·비용 중 확인된 값만 "즉시 · 추가 비용 없음"처럼 한 줄로 합친다. */
export function optionMeta(option: ReportOption): string {
  return [option.time[0], option.cost[0]]
    .filter((value) => value && !value.includes("확인 필요"))
    .join(" · ");
}
