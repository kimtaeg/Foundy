import type { ApiGrant, ApiGrants } from "@/lib/api/types";
import type { Grant } from "@/types/grants";

function noticeUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return undefined;
  }
}

function toGrant(item: ApiGrant): Grant {
  const { summary } = item;
  const amount = summary.how_much?.trim() || "지원 내용 확인 필요";
  return {
    id: item.grant_id,
    title: item.title,
    org: item.org?.trim() || item.source,
    cat: item.category?.trim() || "기타",
    region: item.region?.trim() || "",
    amount,
    deadline: item.deadline,
    res: item.result,
    who: summary.who?.trim() || "공고문 확인 필요",
    how: amount,
    applicationPeriod: summary.until?.trim(),
    url: noticeUrl(item.url),
    submit: summary.what_to_submit ?? [],
    checks: item.checks.map(({ condition, result, note, evidence }) => {
      const quote = evidence?.text?.trim();
      const description = [quote && `“${quote}”`, note?.trim()].filter(Boolean).join(" · ");
      return [condition, result, description || "공고문 확인 필요"];
    }),
  };
}

export function readGrants(response: ApiGrants, allowExamples: boolean) {
  const hasExample = (item: ApiGrant) => item.source.includes("예시") || item.title.includes("(예시 공고)");
  const raw = allowExamples ? response.items : response.items.filter((item) => !hasExample(item));
  const exampleOnly = !allowExamples && response.is_example && !raw.length;
  return {
    catalog: raw.map(toGrant),
    excludedCount: exampleOnly ? 0 : response.excluded_count,
    sourceLabel: exampleOnly ? undefined : response.source ?? undefined,
    status: exampleOnly && !response.error ? "empty" as const : response.status,
  };
}
