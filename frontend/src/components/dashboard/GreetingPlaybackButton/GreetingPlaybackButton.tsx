export interface GreetingPlaybackButtonProps {
  paused: boolean;
  onPauseChange: (paused: boolean) => void;
}

export function GreetingPlaybackButton({ paused, onPauseChange }: GreetingPlaybackButtonProps) {
  return (
    <button type="button" onClick={() => onPauseChange(!paused)} aria-label={paused ? "제목 애니메이션 재생" : "제목 애니메이션 일시정지"}
      className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
      {paused ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.8a.7.7 0 0 1 1.05-.6l8 5.2a.7.7 0 0 1 0 1.2l-8 5.2a.7.7 0 0 1-1.05-.6Z" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></svg>
      )}
      {paused ? "재생" : "일시정지"}
    </button>
  );
}
