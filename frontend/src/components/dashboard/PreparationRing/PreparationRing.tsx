"use client";

import { useId } from "react";
import { PreparationRingArc } from "@/components/dashboard/PreparationRingArc";
import { PreparationRingTransition } from "@/components/dashboard/PreparationRingTransition";
import { buildPreparationRingSegments, buildPreparationRingTransitions } from "@/lib/dashboard/preparation-chart";
import { usePreparationRingMotion } from "@/hooks/usePreparationRingMotion";
import type { DashboardStageProgress } from "@/types/dashboard";

export interface PreparationRingProps {
  done: number;
  total: number;
  stages?: DashboardStageProgress[];
}

export function PreparationRing({ done, total, stages = [] }: PreparationRingProps) {
  const descriptionId = useId();
  const progressMaskId = useId();
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const safeDone = Number.isFinite(done) ? Math.min(safeTotal, Math.max(0, done)) : 0;
  const progress = safeTotal ? safeDone / safeTotal * 100 : 0;
  const percentage = Math.round(progress);
  const segments = buildPreparationRingSegments(stages, { done: safeDone, total: safeTotal });
  const animated = usePreparationRingMotion(progress, segments);
  const paintedSegments = segments.map((segment, index) => ({
    ...segment,
    length: animated.segments[index].length,
    offset: animated.segments.slice(0, index).reduce((sum, previous) => sum + previous.length, 0),
  }));
  const transitions = buildPreparationRingTransitions(paintedSegments, animated.progress === 100);
  const summary = segments.map((segment) => `${segment.label} ${segment.done}개 완료`).join(", ");
  return (
    <div className="relative mx-auto grid size-44 shrink-0 place-items-center sm:size-48"
      role="img" aria-label={safeTotal ? `체크리스트 ${safeTotal}개 중 ${safeDone}개 완료, ${percentage}%` : "아직 등록된 체크리스트가 없습니다"} aria-describedby={summary ? descriptionId : undefined}>
      {summary && <span id={descriptionId} className="sr-only">전체 {safeTotal}개 기준. {summary}</span>}
      <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90">
        {segments.length > 0 && animated.progress < 100 && (
          <defs>
            <mask id={progressMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
              <PreparationRingArc length={animated.progress} color="white" />
            </mask>
          </defs>
        )}
        <circle cx="100" cy="100" r="84" fill="none" stroke="currentColor" strokeWidth="24" className="text-neutral-100" />
        {segments.length ? (
          <g mask={animated.progress < 100 ? `url(#${progressMaskId})` : undefined}>
            {paintedSegments.map((segment) => (
              <g key={segment.label} data-stage={segment.label}>
                <PreparationRingArc length={segment.length} offset={segment.offset} color={segment.color} roundCaps={false} />
              </g>
            ))}
            {transitions.map((transition, index) => <PreparationRingTransition key={`${transition.from}-${transition.to}-${index}`} {...transition} />)}
          </g>
        ) : (
          <PreparationRingArc length={animated.progress} color="var(--color-foundy-primary)" />
        )}
      </svg>
      <div aria-hidden="true" className="text-center">
        <div className="flex items-baseline justify-center gap-0.5 font-semibold leading-none tabular-nums tracking-tight text-neutral-900">
          <span className="text-[44px] leading-none sm:text-[52px]">{safeTotal ? Math.round(animated.progress) : "—"}</span>
          {safeTotal > 0 && <span className="text-xl">%</span>}
        </div>
        <p className="mb-0 mt-1 text-sm text-neutral-600">{safeTotal ? `${safeDone} / ${safeTotal} 완료` : "항목 등록 전"}</p>
      </div>
    </div>
  );
}
