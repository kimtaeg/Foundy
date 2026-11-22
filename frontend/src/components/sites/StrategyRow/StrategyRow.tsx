import type { StrategyItem } from "@/types/market";

export type StrategyRowProps = StrategyItem;

export function StrategyRow({ text, source }: StrategyRowProps) {
  return (
    <div className="flex gap-2.5">
      <span
        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foundy-primary"
        aria-hidden="true"
      />
      <div>
        <p className="m-0 text-sm leading-relaxed text-neutral-700">{text}</p>
        <p className="mb-0 mt-1 text-sm text-neutral-600">{source}</p>
      </div>
    </div>
  );
}
