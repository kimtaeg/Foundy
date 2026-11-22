export interface GrantCardActionsProps {
  id: string;
  title?: string;
}

export function GrantCardActions({ id, title }: GrantCardActionsProps) {
  return (
    <button
      type="button"
      data-nx="gdetail"
      data-id={id}
      aria-haspopup="dialog"
      className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg border-0 bg-transparent px-0 py-2 text-[14px] font-semibold leading-snug text-foundy-primary-ink hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary"
    >
      {title && <span className="sr-only">{title} </span>}
      공고 상세
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </button>
  );
}
