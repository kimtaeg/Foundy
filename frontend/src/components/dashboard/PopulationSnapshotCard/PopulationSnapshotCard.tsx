"use client";

import { useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardCardLink } from "@/components/dashboard/DashboardCardLink";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { PopulationPreviewChart } from "@/components/dashboard/PopulationPreviewChart";
import type { DashboardPopulationSnapshot } from "@/types/dashboard-population";

export interface PopulationSnapshotCardProps {
  data?: DashboardPopulationSnapshot;
  className?: string;
}

export function PopulationSnapshotCard({ data, className }: PopulationSnapshotCardProps) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const activeHour = selectedHour ?? data?.peak?.hour ?? data?.hourly[0]?.hour ?? null;
  const point = data?.hourly.find((item) => item.hour === activeHour);
  const isPeak = activeHour !== null && activeHour === data?.peak?.hour;
  const sourceDate = data?.sourceDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3");
  return (
    <DashboardCard label="시간대별 생활인구" className={className}>
      <DashboardSectionHeader
        title="사람이 모이는 시간"
        action={<DashboardCardLink page="sites" className="-my-2">상권 분석</DashboardCardLink>}
      />
      {data ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="m-0 text-sm font-medium text-neutral-600">{isPeak ? "공개값이 가장 많은 시간" : "선택한 시간"}</p>
              <p className="mb-0 mt-1 text-4xl font-semibold tracking-tight text-neutral-900 tabular-nums">{activeHour === null ? "—" : `${String(activeHour).padStart(2, "0")}시`}</p>
            </div>
            <p className="m-0 pb-1 text-right text-sm text-neutral-600">
              <span className="mt-1 block text-xs">{point?.value == null ? "공개 수치 없음" : point.partial ? "일부 공개값 합계" : "공개값 합계"}</span>
              <strong className="text-lg font-semibold text-foundy-primary-ink tabular-nums">{point?.value != null ? Math.round(point.value).toLocaleString("ko-KR") : "—"}</strong>{point?.value != null && "명"}
            </p>
          </div>
          <PopulationPreviewChart points={data.hourly} selectedHour={activeHour} onSelectHour={setSelectedHour} />
          <p className="mb-0 mt-4 text-xs leading-relaxed text-neutral-600">{sourceDate} · {data.sourceLabel}</p>
        </>
      ) : (
        <div className="flex flex-col py-6">
          <p className="m-0 text-lg font-semibold text-neutral-900">상권의 하루를 살펴보세요</p>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-neutral-600">분석 데이터가 연결되면 시간대별 생활인구를 이곳에서 확인할 수 있어요.</p>
        </div>
      )}
    </DashboardCard>
  );
}
