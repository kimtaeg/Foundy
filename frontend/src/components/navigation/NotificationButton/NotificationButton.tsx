import { KeyboardEventHandler, Ref } from "react";

export interface NotificationButtonProps {
  unread: number;
  open: boolean;
  panelId: string;
  buttonRef: Ref<HTMLButtonElement>;
  onToggle: () => void;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
}
export function NotificationButton({
  unread,
  open,
  panelId,
  buttonRef,
  onToggle,
  onKeyDown,
}: NotificationButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      onKeyDown={onKeyDown}
      aria-label={`알림, 읽지 않은 알림 ${unread}개`}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-haspopup="dialog"
      className={`relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border-0 shadow-none! transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-foundy-primary ${open ? "bg-neutral-100 text-foundy-primary" : "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-foundy-primary"}`}
    >
      <svg
        aria-hidden="true"
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2a2 2 0 0 1 2 2v.35A7 7 0 0 1 19 11v4.2l1.55 2.32A.95.95 0 0 1 19.76 19H4.24a.95.95 0 0 1-.79-1.48L5 15.2V11a7 7 0 0 1 5-6.65V4a2 2 0 0 1 2-2Zm-2.83 18h5.66a3 3 0 0 1-5.66 0Z" />
      </svg>
      {unread > 0 && (
        <>
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 size-1.5 rounded-full bg-foundy-primary"
          />
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-1 min-w-5 rounded-full bg-foundy-primary px-1 text-center text-xs leading-5 font-extrabold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        </>
      )}
    </button>
  );
}
