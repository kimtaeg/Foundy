import { GrantConditions } from "@/components/grants/GrantConditions";
import { GrantDetailSummary } from "@/components/grants/GrantDetailSummary";
import { GrantPoster } from "@/components/grants/GrantPoster";
import type { Grant } from "@/types/grants";

export interface GrantDetailsProps {
  grant: Grant;
  deadline: string;
  result: { label: string; tone: string };
}

export function GrantDetails({ grant, deadline, result }: GrantDetailsProps) {
  return (
    <div className="grid min-w-0 gap-5 [container-type:inline-size]">
      <GrantPoster grant={grant} variant="detail" />
      <GrantDetailSummary grant={grant} deadline={deadline} result={result} />
      {grant.checks.length > 0 && (
        <section>
          <h3 className="m-0 border-0 border-b border-solid border-neutral-200 pb-2 text-base font-semibold text-neutral-900">
            조건별 판정과 공고문 인용
          </h3>
          <GrantConditions checks={grant.checks} />
        </section>
      )}
      {grant.url && (
        <a href={grant.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 border-0 py-2 text-sm font-semibold text-foundy-primary-ink hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
          공고 원문 보기 <span aria-hidden="true">↗</span><span className="sr-only">(새 창)</span>
        </a>
      )}
    </div>
  );
}
