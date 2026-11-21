import { PageHeader } from "@/components/common/PageHeader";
import { Element } from "@/components/view/Element";

export type ReportHeaderProps = { locked: boolean };

export function ReportHeader({ locked }: ReportHeaderProps) {
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
          <Element as="span" className="nx-badge unknown">
            예시 데이터 · 실제 조회 아님
          </Element>
        )
      }
    />
  );
}
