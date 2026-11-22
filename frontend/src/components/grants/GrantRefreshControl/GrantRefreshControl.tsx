export interface GrantRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export function GrantRefreshControl({ refreshing, onRefresh }: GrantRefreshControlProps) {
  return (
    <button type="button" disabled={refreshing} onClick={onRefresh}
      className="ml-auto min-h-11 shrink-0 cursor-pointer border-0 bg-transparent px-0 text-sm font-semibold text-foundy-primary-ink underline-offset-4 enabled:hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary disabled:cursor-wait disabled:text-neutral-600">
      <span aria-live="polite">{refreshing ? "공고 조회 중" : "공고 새로 조회"}</span>
    </button>
  );
}
