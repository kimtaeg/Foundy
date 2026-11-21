import { DocRow } from "@/components/docs/DocRow";
import { Element } from "@/components/view/Element";
import type { Contact } from "@/types/contact";
import type { DocumentTaskViewData } from "@/types/documents";

export interface DocTaskCardProps {
  row: DocumentTaskViewData;
  contacts: Record<string, Contact>;
}
export function DocTaskCard({ row, contacts }: DocTaskCardProps) {
  const { task, documents, deadline } = row;
  return (
    <Element as="section" className="nx-card" id={`doc-${task.id}`}>
      <div className="nx-heading">
        <div>
          <h3>{task.task}</h3>
          <Element className="nx-muted">
            {task.group} · {task.category} · 예정{" "}
            {task.due.slice(5).replace("-", ".")} ({deadline})
          </Element>
        </div>
        {task.done && (
          <Element as="span" className="nx-badge ok">
            항목 완료
          </Element>
        )}
      </div>
      {documents.map((document) => (
        <DocRow
          key={document.id}
          document={document}
          contact={document.contact ? contacts[document.contact] : undefined}
        />
      ))}
    </Element>
  );
}
