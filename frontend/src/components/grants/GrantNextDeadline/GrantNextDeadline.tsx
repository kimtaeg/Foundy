import { GrantBadge } from "@/components/grants/GrantBadge";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { GrantViewItem } from "@/types/grant-view";

export interface GrantNextDeadlineProps { item: GrantViewItem }

export function GrantNextDeadline({ item }: GrantNextDeadlineProps) {
  return (
    <blockquote aria-label="가장 가까운 마감" className="mx-0 mb-5 mt-0 rounded-r-lg border-0 border-l-[3px] border-solid border-foundy-primary bg-foundy-primary/5">
      <button type="button" data-nx="gdetail" data-id={item.grant.id} aria-haspopup="dialog"
        className="flex min-h-11 w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-r-lg border-0 bg-transparent px-3.5 py-2.5 text-left text-sm leading-6 hover:bg-foundy-primary/5 sm:px-4">
        <span className="inline-flex items-center gap-2 font-medium text-foundy-primary-ink">가장 가까운 마감 {item.grant.deadline && <GrantBadge label={item.deadline} />}</span>
        <span className="min-w-0 break-keep font-semibold text-neutral-900 [overflow-wrap:anywhere]">{grantDisplay(item.grant).title}</span>
        {item.grant.deadline && <time dateTime={item.grant.deadline} className="text-neutral-600 tabular-nums">{item.grant.deadline.replaceAll("-", ".")}</time>}
      </button>
    </blockquote>
  );
}
