import { ChatSupportIcon } from "@/components/chat/ChatSupportIcon";

export interface ChatLauncherProps { open: boolean }

export function ChatLauncher({ open }: ChatLauncherProps) {
  return (
    <button
      type="button"
      data-nx="chattoggle"
      aria-label={open ? "상담 닫기" : "파운디 상담 열기"}
      aria-expanded={open}
      aria-controls="chatPanel"
      className={`pointer-events-auto inline-flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full border-0 px-3 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary motion-reduce:transition-none ${
        open
          ? "bg-white text-neutral-700 shadow-[0_0_0_1px_#e5e5e5,0_4px_16px_rgba(0,0,0,0.06)] hover:bg-neutral-50 hover:text-neutral-900"
          : "bg-foundy-primary text-white shadow-[0_4px_16px_rgba(16,126,125,0.20)] hover:bg-foundy-primary-ink"
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative flex size-6 shrink-0 items-center justify-center rounded-full`}
      >
        <span className={`absolute flex transition-[opacity,transform] duration-150 motion-reduce:transition-none ${open ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}>
          <ChatSupportIcon />
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className={`absolute size-5 transition-[opacity,transform] duration-150 motion-reduce:transition-none ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-45 scale-75 opacity-0"}`}
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </span>
    </button>
  );
}
