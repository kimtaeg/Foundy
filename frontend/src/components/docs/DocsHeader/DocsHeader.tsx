import { PageHeader } from "@/components/common/PageHeader";
import Link from "next/link";

export function DocsHeader() {
  return (
    <PageHeader
      eyebrow="DOCUMENT CENTER"
      title="서류함"
      description="개업 준비에 필요한 서류와 발급처를 확인하세요."
      actionsLayout="inline"
      actions={
        <Link href="/checklist" className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-foundy-primary-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary sm:text-base">
          체크리스트 보기
          <span aria-hidden="true">→</span>
        </Link>
      }
    />
  );
}
