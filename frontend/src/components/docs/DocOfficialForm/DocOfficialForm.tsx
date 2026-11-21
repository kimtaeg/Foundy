import { Element } from "@/components/view/Element";
import type { ManagedDocument } from "@/types/documents";

export interface DocOfficialFormProps {
  form: NonNullable<ManagedDocument["form"]>;
}

/** 법령에 첨부된 공식 서식. 링크는 국가법령정보센터 원본이고, 개정일을 같이 보여 준다. */
export function DocOfficialForm({ form }: DocOfficialFormProps) {
  const open = form.pdfUrl ?? form.fileUrl;
  return (
    <Element className="nx-row" style={{ marginTop: 8 }}>
      {open ? (
        <>
          <Element as="a" className="nx-btn outline slim" href={open} target="_blank" rel="noopener noreferrer">
            공식 서식 열기 ↗
          </Element>
          {form.pdfUrl && form.fileUrl && (
            <Element as="a" className="nx-btn ghost slim" href={form.fileUrl} target="_blank" rel="noopener noreferrer">
              원본 파일 ↗
            </Element>
          )}
          <Element as="span" className="nx-tag">
            {form.title}
            {form.revision ? ` · ${form.revision} 공포` : ""} · 국가법령정보센터
          </Element>
        </>
      ) : (
        <Element as="span" className="nx-tag">공식 서식({form.title}) 링크를 아직 받아 오지 못했어요. 정부24에서 찾아보세요.</Element>
      )}
    </Element>
  );
}
