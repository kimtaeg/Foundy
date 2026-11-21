import { DOC_UPLOAD_ACCEPT } from "@/data/documents";
import { Element } from "@/components/view/Element";
import type { ManagedDocument } from "@/types/documents";

export interface DocFilesProps {
  document: ManagedDocument;
}

/** 발급받거나 작성한 파일을 올려 두는 곳. 파일은 내 서류함에만 보인다. */
export function DocFiles({ document }: DocFilesProps) {
  const { id, name, files } = document;
  return (
    <Element className="nx-seg">
      <Element className="nx-seg-title">내 파일</Element>
      {files.length === 0 && (
        <Element className="nx-muted">발급받거나 작성한 파일을 올리면 “발급·취득 완료”로 바뀌어요. (PDF·이미지·한글, 10MB까지)</Element>
      )}
      {files.map((file) => (
        <Element className="nx-prep" key={file.id}>
          <div>
            <b>{file.name}</b>
            <Element className="nx-muted">
              {file.size} · {file.uploadedAt} 올림{file.issuedOn ? ` · 발급일 ${file.issuedOn}` : ""}
            </Element>
          </div>
          <Element className="nx-row">
            <Element as="button" type="button" className="nx-btn outline slim" data-nx="docget" data-did={id} data-fid={file.id}>
              내려받기
            </Element>
            <Element as="button" type="button" className="nx-btn ghost slim" data-nx="docdel" data-did={id} data-fid={file.id}>
              삭제
            </Element>
          </Element>
        </Element>
      ))}
      <Element as="label" className="nx-btn outline slim" style={{ marginTop: 8 }}>
        파일 올리기
        <input type="file" hidden accept={DOC_UPLOAD_ACCEPT} data-doc-upload={id} aria-label={`${name} 파일 올리기`} />
      </Element>
    </Element>
  );
}
