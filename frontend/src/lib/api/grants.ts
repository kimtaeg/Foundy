/** 지원사업 응답(GET /api/stores/{id}/grants) → 지원사업 화면 데이터. */
import type { ApiGrant, ApiGrants } from "@/lib/api/types";
import type { GrantStatus } from "@/types/grant-view";
import type { Grant } from "@/types/grants";

const HUE: [string, string] = ["#fafafa", "#f5f5f5"];

export function toGrant(item: ApiGrant): Grant {
  const summary = item.summary ?? { who: null, how_much: null, until: null, what_to_submit: null };
  return {
    id: item.grant_id,
    title: item.title,
    org: item.org ?? item.source,
    cat: item.category ?? "기타",
    region: item.region ?? "확인 필요",
    amount: summary.how_much ?? "[확인 필요]",
    deadline: item.deadline,
    res: item.result,
    hue: HUE,
    who: summary.who ?? "[확인 필요]",
    how: summary.how_much ?? "[확인 필요]",
    submit: summary.what_to_submit ?? [],
    checks: item.checks.map((check) => [
      check.condition,
      check.result,
      check.evidence?.text ? `“${check.evidence.text}”${check.note ? ` · ${check.note}` : ""}` : check.note || "공고문에서 확인하지 못했어요",
    ]),
    url: item.url,
    example: item.source.includes("예시"),
  };
}

/** 지원사업 화면 컨텍스트 중 서버 데이터 부분. 응답을 못 받았으면 불러오지 못함으로 둔다 */
export function grantsModel(grants: ApiGrants | null, loading = false) {
  const status: GrantStatus = {
    state: loading ? "loading" : (grants?.status ?? "unavailable"),
    source: grants?.source ?? null,
    judgedAt: grants?.judged_at ?? null,
    example: grants?.is_example ?? false,
  };
  return {
    GRANTS: (grants?.items ?? []).map(toGrant),
    GRANT_EXCLUDED: grants?.excluded_count ?? 0,
    GRANT_STATUS: status,
  };
}
