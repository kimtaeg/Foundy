import { OptionCard } from "@/components/report/OptionCard";
import type { ReportCardData } from "@/types/report";

export interface ReportChoiceDialogProps {
  card: ReportCardData;
}

export function ReportChoiceDialog({ card }: ReportChoiceDialogProps) {
  return (
    <div className="grid min-w-0 gap-4">
      <h3 className="m-0 break-keep text-lg font-semibold leading-snug tracking-tight text-neutral-900 [overflow-wrap:anywhere]">{card.decisionTask ?? card.title}</h3>
      <ul aria-label="선택지" className="m-0 min-w-0 list-none p-0">
        {card.options.map((option) => (
          <li key={option.id} className="border-0 border-t border-solid border-neutral-200">
            <OptionCard cardId={card.id} option={option} recommended={card.rec?.id === option.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
