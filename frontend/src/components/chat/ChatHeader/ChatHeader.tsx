import { ChatSupportIcon } from "@/components/chat/ChatSupportIcon";

export function ChatHeader() {
  return (
    <header className="flex shrink-0 items-center gap-3 border-0 border-b border-solid border-neutral-100 bg-white px-5 py-4">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foundy-primary-ink text-white"
        aria-hidden="true"
      >
        <ChatSupportIcon />
      </span>
      <div className="min-w-0 flex-1">
        <h2
          id="chatTitle"
          className="m-0 text-base font-bold leading-6 text-neutral-900"
        >
          파운디 도우미
        </h2>
        <p className="m-0 text-sm leading-5 text-neutral-600">
          내 가게 맞춤 안내
        </p>
      </div>
      <button
        type="button"
        data-nx="chattoggle"
        aria-label="상담 닫기"
        title="상담 닫기"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border-0 bg-neutral-50 text-neutral-600 transition-[background-color,color,transform] duration-150 hover:bg-neutral-100 hover:text-neutral-900 motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none"
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </header>
  );
}
