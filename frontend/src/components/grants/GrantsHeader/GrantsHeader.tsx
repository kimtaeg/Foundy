import { PageHeader } from "@/components/common/PageHeader";
import { GrantNextDeadline } from "@/components/grants/GrantNextDeadline";
import { grantSourceLabel } from "@/lib/grants/format-grant";
import type { GrantViewItem } from "@/types/grant-view";

export interface GrantsHeaderProps {
  sourceLabel?: string;
  nextDeadline?: GrantViewItem | null;
}

export function GrantsHeader({ nextDeadline, sourceLabel }: GrantsHeaderProps = {}) {
  const source = grantSourceLabel(sourceLabel);
  return (
    <PageHeader
      eyebrow="PUBLIC PROGRAMS"
      notice={nextDeadline && <GrantNextDeadline item={nextDeadline} />}
      title="정책·지원사업"
      breadcrumbLabel="지원사업"
      actionsLayout="inline"
      actions={source && (
        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2.5 py-1 text-sm font-medium text-neutral-600">{source}</span>
      )}
      description="내 가게의 신청 조건과 공고별 지원 내용, 마감 일정을 확인하세요."
    />
  );
}
