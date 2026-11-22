import type { CitationItem } from "@/types/chat";

export interface MessageCitationsProps {
  citations: CitationItem[];
}

const citationClass = "max-w-full shrink-0 rounded-lg border border-solid border-neutral-200 bg-white px-2 py-1 text-left text-xs leading-5 text-neutral-700 [overflow-wrap:anywhere]";
const linkClass = `${citationClass} transition-colors hover:bg-neutral-100 hover:text-foundy-primary-ink`;

export function MessageCitations({ citations }: MessageCitationsProps) {
  if (!citations.length) return null;
  return (
    <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label="답변 근거">
      {citations.map((citation, index) => {
        const arrow = <span aria-hidden="true">↗</span>;
        if (citation.url) return (
          <a key={index} className={linkClass} href={citation.url} target="_blank" rel="noreferrer">
            {citation.label} {arrow}
          </a>
        );
        if (citation.page || citation.cardId) return (
          <button
            key={index}
            type="button"
            className={linkClass}
            data-nx={citation.cardId ? "cevid" : "cnav"}
            data-id={citation.cardId}
            data-p={citation.page}
            data-focus={citation.focus}
          >
            {citation.label} {arrow}
          </button>
        );
        return <span key={index} className={citationClass}>{citation.label}</span>;
      })}
    </div>
  );
}
