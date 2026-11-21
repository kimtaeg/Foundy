import { Element } from "@/components/view/Element";
import type { ObligationData } from "@/types/report";

const STATUS: Record<ObligationData["status"], { label: string; order: number }> = {
  applies: { label: "적용", order: 0 },
  needs_check: { label: "확인 필요", order: 1 },
  not_applicable: { label: "해당 없음", order: 2 },
};

export interface ObligationsSectionProps { items: ObligationData[] }

/** 규칙 엔진이 이 가게 조건으로 정한 법령 적용 결과. 위 점검 카드의 판정과는 별개의 참고 목록이다. */
export function ObligationsSection({ items }: ObligationsSectionProps) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => STATUS[a.status].order - STATUS[b.status].order);
  const missing = [...new Set(items.flatMap((item) => item.missing_inputs.map((input) => input.label)))];
  return (
    <Element as="section" className="nx-card" aria-label="법령 적용 결과">
      <h3>법령 적용 결과</h3>
      <Element as="p" className="nx-muted">
        가게 조건(업종·면적·층·직원 등)으로 확인한 규정이에요. 법적 판정이 아니라 점검 대상을 추리는 목록이에요.
      </Element>
      {missing.length > 0 && (
        <Element className="nx-note">
          {missing.join(", ")}을(를) 입력하면 더 정확히 확인할 수 있어요. 마이페이지에서 입력할 수 있어요.
        </Element>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {sorted.map((item) => (
          <li key={item.rule_id} style={{ display: "grid", gap: 2 }}>
            <strong>
              [{STATUS[item.status].label}] {item.title}
            </strong>
            <span>{item.reason}</span>
            {item.law.law_name && (
              <small>
                근거: {item.law.url ? (
                  <a href={item.law.url} target="_blank" rel="noreferrer">
                    {item.law.law_name} {item.law.article ?? ""}
                  </a>
                ) : (
                  `${item.law.law_name} ${item.law.article ?? ""}`
                )}
              </small>
            )}
            {item.status !== "not_applicable" && item.required_action && <small>할 일: {item.required_action}</small>}
          </li>
        ))}
      </ul>
    </Element>
  );
}
