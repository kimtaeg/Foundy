export interface LoginSubmitButtonProps {
  pending?: boolean;
  label?: string;
  pendingLabel?: string;
}

export function LoginSubmitButton({ pending = false, label = "로그인", pendingLabel = "로그인 중…" }: LoginSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-0 bg-foundy-primary px-5 text-base font-semibold text-white transition-colors duration-150 enabled:hover:bg-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={pending ? "hidden" : "transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"}>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </button>
  );
}
