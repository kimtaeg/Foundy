import { PageHeader } from "@/components/common/PageHeader";
import { Element } from "@/components/view/Element";

export type ReportHeaderProps = {
  locked: boolean;
  /** 서버가 실제로 조회·판정한 결과로 그린 화면이면 true, 로컬 예시 화면이면 false */
  live?: boolean;
  /** 실제 조회가 아니라 예시 자료로 판정한 항목 수 (live 일 때만 의미) */
  exampleCount?: number;
};

/** 데이터 출처 배지: 실제 조회 결과인지, 일부 예시 자료가 섞였는지, 전부 예시인지 숨기지 않고 알린다. */
function sourceBadge(live: boolean, exampleCount: number): { label: string; tone: string } {
  if (!live) return { label: "예시 데이터 · 실제 조회 아님", tone: "unknown" };
  if (exampleCount > 0) return { label: `일부 예시 자료 (${exampleCount}개 항목)`, tone: "low" };
  return { label: "실제 조회 결과", tone: "ok" };
}

export function ReportHeader({ locked, live = false, exampleCount = 0 }: ReportHeaderProps) {
  const badge = sourceBadge(live, exampleCount);
  return (
    <PageHeader
      eyebrow="DECISION REPORT"
      title="점검 리포트"
      description={
        locked
          ? "자리를 정하면 건물·법·상표 점검이 시작돼요."
          : "급한 것부터 확인하고, 항목마다 방법을 골라 정하세요."
      }
      actions={
        !locked && (
          <Element as="span" className={`nx-badge ${badge.tone}`}>
            {badge.label}
          </Element>
        )
      }
    />
  );
}
