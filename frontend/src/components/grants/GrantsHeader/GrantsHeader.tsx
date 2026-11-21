import { PageHeader } from "@/components/common/PageHeader";
import { Element } from "@/components/view/Element";

export interface GrantsHeaderProps {
  /** 화면 오른쪽 위 배지. 없으면 예시 공고 표시 */
  badge?: { label: string; tone: string };
}

export function GrantsHeader({ badge = { label: "예시 공고 · 실제 아님", tone: "unknown" } }: GrantsHeaderProps) {
  return (
    <PageHeader
      eyebrow="PUBLIC PROGRAMS"
      title="정책·지원사업"
      description="모집 중인 공고문의 조건과 내 가게를 대조한 결과예요. 나이·업력·지역은 계산하고, 나머지 조건은 AI가 공고문을 읽고 판단해요."
      actions={
        <Element as="span" className={`nx-badge ${badge.tone}`}>
          {badge.label}
        </Element>
      }
    />
  );
}
