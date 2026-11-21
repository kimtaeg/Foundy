import { Element } from "@/components/view/Element";
import { VL } from "@/data/report";
import { type Verdict } from "@/types/report";

const verdicts: Verdict[] = ["high", "low", "unknown", "ok"];

/** 판정별 개수를 한 줄로 보여 주고, 누르면 해당 카드로 이동한다. */
export type ReportSummaryProps = {
  counts: Record<Verdict, number>;
  firstByVerdict: Partial<Record<Verdict, string>>;
};

export function ReportSummary({
  counts,
  firstByVerdict,
}: ReportSummaryProps) {
  return (
    <Element className="nx-badges mb-3.5">
      {verdicts
        .filter((key) => counts[key] > 0)
        .map((key) => (
          <Element
            as="button"
            key={key}
            type="button"
            className={`nx-badge ${key} cursor-pointer border-0 text-sm`}
            data-nx="go"
            data-p="report"
            data-focus={firstByVerdict[key]}
          >
            {VL[key]} {counts[key]}
          </Element>
        ))}
    </Element>
  );
}
