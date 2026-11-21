import { PageHeader } from "@/components/common/PageHeader";
import { Element } from "@/components/view/Element";

export function GrantsHeader() {
  return (
    <PageHeader
      eyebrow="PUBLIC PROGRAMS"
      title="정책·지원사업"
      description="공고문 조건과 내 가게를 대조한 결과예요. 포스터는 공고 이미지가 있으면 그것으로 바뀌어요."
      actions={
        <Element as="span" className="nx-badge unknown">
          예시 공고 · 실제 아님
        </Element>
      }
    />
  );
}
