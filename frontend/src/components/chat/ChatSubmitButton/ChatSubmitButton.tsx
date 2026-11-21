export interface ChatSubmitButtonProps {
  busy: boolean;
  disabled: boolean;
}

export function ChatSubmitButton({ busy, disabled }: ChatSubmitButtonProps) {
  return (
    <button
      type={busy ? "button" : "submit"}
      data-nx={busy ? "cstop" : undefined}
      disabled={!busy && disabled}
      aria-label={busy ? "답변 생성 중지" : "질문 보내기"}
      title={busy ? "답변 생성 중지" : "질문 보내기"}
      className="flex size-10 shrink-0 items-center justify-center rounded-2xl border-0 bg-foundy-primary text-white transition-colors hover:bg-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 motion-reduce:transition-none"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
        {busy ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          <path
            d="M12 19V5m-6 6 6-6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
