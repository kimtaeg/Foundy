"use client";

import { Suspense, useState } from "react";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { ReportCard } from "@/components/report/ReportCard";
import { REPORT_STAGES } from "@/data/report";
import type { ReportCardModel } from "@/types/report";

export interface ReportItemsProps {
  cards: ReportCardModel[];
}

type DisclosureOverride = {
  expanded: boolean;
  preferredOpen: boolean;
  followUpPending: boolean;
};

function groupByStage(cards: ReportCardModel[]) {
  const groups = new Map<string, ReportCardModel[]>(REPORT_STAGES.map((stage) => [stage, []]));

  for (const model of cards) {
    const label = model.card.stage?.trim() || "단계 미지정";
    const group = groups.get(label);
    if (group) group.push(model);
    else groups.set(label, [model]);
  }
  return Array.from(groups).filter(([, items]) => items.length > 0);
}

export function ReportItems({ cards }: ReportItemsProps) {
  const [overrides, setOverrides] = useState(() => new Map<string, DisclosureOverride>());
  // A new recommendation or follow-up supersedes the manual choice. Filtered-out rows keep theirs.
  const outdated = cards.filter(({ card, open, followUpPending }) => {
    const saved = overrides.get(card.id);
    return saved && (saved.preferredOpen !== open || saved.followUpPending !== followUpPending);
  });
  if (outdated.length) {
    const next = new Map(overrides);
    for (const { card } of outdated) next.delete(card.id);
    setOverrides(next);
  }

  function setExpanded(model: ReportCardModel, expanded: boolean) {
    setOverrides((current) => {
      const next = new Map(current);
      if (expanded === model.open) next.delete(model.card.id);
      else next.set(model.card.id, { expanded, preferredOpen: model.open, followUpPending: model.followUpPending });
      return next;
    });
  }

  if (!cards.length) {
    return (
      <p role="status" className="m-0 border-0 border-t border-solid border-neutral-200 py-8 text-base text-neutral-600">
        해당 단계의 결과가 없어요.
      </p>
    );
  }

  function renderCard(model: ReportCardModel) {
    return (
      <Suspense key={model.card.id} fallback={<SectionSkeleton variant="list" rows={1} appearance="plain" label={model.card.title} />}>
        <ReportCard model={model} expanded={overrides.get(model.card.id)?.expanded ?? model.open}
          onExpandedChange={(expanded) => setExpanded(model, expanded)} />
      </Suspense>
    );
  }

  return (
    <div className="ml-1 border-0 border-l border-solid border-neutral-200 pl-5 sm:pl-7">
      {groupByStage(cards).map(([label, items]) => (
        <section key={label} aria-label={label} className="relative min-w-0 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-x-6">
          <span aria-hidden="true" className="absolute -left-[1.625rem] top-[0.65rem] size-2.5 rounded-full bg-foundy-primary ring-4 ring-white sm:-left-[2.125rem]" />
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h3 className="m-0 text-base font-semibold leading-7 text-neutral-900 sm:text-lg">{label}</h3>
            <span className="text-sm font-medium tabular-nums text-neutral-600">{items.length}건</span>
          </div>
          <div className="min-w-0">{items.map(renderCard)}</div>
        </section>
      ))}
    </div>
  );
}
