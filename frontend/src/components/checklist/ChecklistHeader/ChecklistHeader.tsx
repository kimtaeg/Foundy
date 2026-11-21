import { PageHeader } from "@/components/common/PageHeader";
import { Element } from "@/components/view/Element";

export function ChecklistHeader() {
  return (
    <PageHeader
      eyebrow="OPENING ROADMAP"
      title="개업 체크리스트"
      description="시기별·카테고리별·달력으로 한 번에 확인하세요."
      actions={
        <Element className="nx-row">
          <Element as="button" className="nx-btn outline" data-nx="editDate">
            개업일 수정
          </Element>
          <Element as="button" className="nx-btn outline" data-nx="ics">
            캘린더로 내보내기 (.ics)
          </Element>
        </Element>
      }
    />
  );
}
