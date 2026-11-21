import { DocCard } from "@/components/docs/DocCard";
import { Element } from "@/components/view/Element";
import type { Contact } from "@/types/contact";
import type { ManagedDocumentSection } from "@/types/documents";

export interface DocSectionCardProps {
  section: ManagedDocumentSection;
  contacts: Record<string, Contact>;
}

export function DocSectionCard({ section, contacts }: DocSectionCardProps) {
  return (
    <Element as="section" className="nx-card">
      <h3>
        {section.title}{" "}
        <Element as="span" className="nx-badge">
          {section.documents.length}개
        </Element>
      </h3>
      {section.documents.map((document) => (
        <DocCard
          key={document.id}
          document={document}
          contact={document.contact ? contacts[document.contact] : undefined}
        />
      ))}
    </Element>
  );
}
