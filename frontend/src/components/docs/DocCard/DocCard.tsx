import { DocFiles } from "@/components/docs/DocFiles";
import { DocOfficialForm } from "@/components/docs/DocOfficialForm";
import { DocStatusSelect } from "@/components/docs/DocStatusSelect";
import { PhoneContact } from "@/components/common/PhoneContact";
import { Element } from "@/components/view/Element";
import type { Contact } from "@/types/contact";
import type { ManagedDocument } from "@/types/documents";

export interface DocCardProps {
  document: ManagedDocument;
  contact?: Contact;
}

const TONE: Record<ManagedDocument["status"], string> = {
  not_started: "",
  in_progress: "low",
  obtained: "ok",
  submitted: "ok",
  needs_fix: "high",
  not_applicable: "",
};

const monthDay = (date: string) => date.slice(5).replace("-", ".");

/** 서류 한 장: 유형·상태·준비 방법·공식 서식·내 파일·연결된 작업. */
export function DocCard({ document, contact }: DocCardProps) {
  const dim = document.status === "not_applicable";
  return (
    <Element className="nx-doc mt-4 block border-t border-neutral-200 pt-4 first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0" style={{ opacity: dim ? 0.6 : 1 }}>
      {document.anchors.map((task) => (
        <span key={task} id={`doc-${task}`} />
      ))}
      <div className="nx-heading">
        <div style={{ minWidth: 0 }}>
          <Element className="nx-badges" style={{ marginBottom: 4 }}>
            <Element as="span" className={`nx-badge ${TONE[document.status]}`.trim()}>
              {document.statusLabel}
            </Element>
            <Element as="span" className="nx-badge">{document.typeLabel}</Element>
            {document.applicability === "needs_check" && <Element as="span" className="nx-badge low">해당 여부 확인</Element>}
            {document.aiAdded && <Element as="span" className="nx-badge ok">AI 분석에서 추가됨</Element>}
          </Element>
          <b>{document.name}</b>
        </div>
        <DocStatusSelect id={document.id} name={document.name} status={document.status} />
      </div>
      <Element className="nx-muted">
        {document.agency} · {document.guide}
      </Element>
      {document.reason && <Element className="nx-muted">왜 필요한가요: {document.reason}</Element>}
      {document.lawBasis && (
        <Element className="nx-muted">
          근거:{" "}
          {document.lawBasis.url ? (
            <Element as="a" href={document.lawBasis.url} target="_blank" rel="noopener noreferrer">
              {document.lawBasis.label} ↗
            </Element>
          ) : (
            document.lawBasis.label
          )}
        </Element>
      )}
      <PhoneContact contact={contact} />
      <Element className="nx-row" style={{ marginTop: 8 }}>
        {document.sites.map((site) => (
          <Element key={site.url} as="a" className="nx-btn outline slim" href={site.url} target="_blank" rel="noopener noreferrer">
            {site.label} ↗
          </Element>
        ))}
      </Element>
      {document.form && <DocOfficialForm form={document.form} />}
      {document.tasks.length > 0 && (
        <Element className="nx-tag" style={{ marginTop: 8 }}>
          쓰이는 작업:{" "}
          {document.tasks.map((task, index) => (
            <span key={task.id}>
              {index > 0 && " · "}
              {task.task}
              {task.done ? " (완료)" : ""}
            </span>
          ))}
          {document.due ? ` · 준비 권장 ${monthDay(document.due)}${document.deadline ? ` (${document.deadline})` : ""}` : ""}
          {document.statutoryDate ? ` · 법정 기한 ${monthDay(document.statutoryDate)}까지` : ""}
        </Element>
      )}
      {document.review && (
        <Element className="nx-note" style={{ marginTop: 8 }}>
          {document.review}{" "}
          <Element as="button" type="button" className="nx-btn outline slim" data-nx="docack" data-did={document.id}>
            확인했어요
          </Element>
        </Element>
      )}
      <DocFiles document={document} />
    </Element>
  );
}
