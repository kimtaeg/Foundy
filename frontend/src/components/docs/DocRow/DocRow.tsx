import { PhoneContact } from "@/components/common/PhoneContact";
import { Element } from "@/components/view/Element";
import type { Contact } from "@/types/contact";
import type { DocumentViewData } from "@/types/documents";

export interface DocRowProps {
  document: DocumentViewData;
  contact?: Contact;
}
export function DocRow({ document, contact }: DocRowProps) {
  return (
    <div className="nx-doc">
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{document.name}</b>
        <Element className="nx-muted">
          {document.agency} · {document.guide}
        </Element>
        <PhoneContact contact={contact} />
        <Element className="nx-row" style={{ marginTop: 8 }}>
          {document.sites.map((site) => {
            return (
              <Element
                as="a"
                key={site.url}
                className="nx-btn outline slim"
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {site.label} ↗
              </Element>
            );
          })}
        </Element>
      </div>
    </div>
  );
}
