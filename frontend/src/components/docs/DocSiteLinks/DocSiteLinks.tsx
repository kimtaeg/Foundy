import type { DocumentSite } from "@/types/documents";

export interface DocSiteLinksProps {
  sites: DocumentSite[];
}

export function DocSiteLinks({ sites }: DocSiteLinksProps) {
  if (!sites.length) return null;
  return (
    <ul aria-label="공식 사이트" className="mb-0 mt-1 flex list-none flex-wrap gap-x-5 p-0">
      {sites.map((site) => (
        <li key={site.url} className="min-w-0">
          <a href={site.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-sm text-sm font-semibold text-foundy-primary-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
            <span className="[overflow-wrap:anywhere]">{site.label}</span>
            <span className="sr-only"> (새 창)</span>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M6 18 18 6M7 6h11v11" />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
