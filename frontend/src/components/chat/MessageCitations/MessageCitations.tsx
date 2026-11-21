import { type CitationItem } from "@/types/chat";

export interface MessageCitationsProps { citations: CitationItem[] }

export function MessageCitations({ citations }: MessageCitationsProps) {
  if (!citations.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="답변 근거">
      <span className="text-xs font-medium text-neutral-600">근거</span>
      {citations.map((citation, index) => (
        <button
          type="button"
          key={index}
          className="max-w-full rounded-lg border border-solid border-neutral-200 bg-white px-2 py-1 text-left text-xs leading-5 text-neutral-700 transition-colors [overflow-wrap:anywhere] hover:bg-neutral-100 hover:text-foundy-primary-ink"
          data-nx={citation.cardId ? "cevid" : "cnav"}
          data-id={citation.cardId}
          data-p={citation.page}
          data-focus={citation.cardId ? undefined : ""}
        >
          {citation.label} <span aria-hidden="true">↗</span>
        </button>
      ))}
    </div>
  );
}
