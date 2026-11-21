import { DocCard } from "@/components/docs/DocCard";
import { Element } from "@/components/view/Element";
import type { ManagedDocumentSection } from "@/types/documents";

export interface DocSectionCardProps {
  section: ManagedDocumentSection;
}

export function DocSectionCard({ section }: DocSectionCardProps) {
  return (
    <Element as="section" className="nx-card">
      <h3>
        {section.title}{" "}
        <Element as="span" className="nx-badge">
          {section.documents.length}개
        </Element>
      </h3>
      {section.documents.map((document) => (
        <DocCard key={document.id} document={document} />
      ))}
    </Element>
  );
}
