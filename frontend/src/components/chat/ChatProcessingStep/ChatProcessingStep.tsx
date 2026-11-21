export interface ChatProcessingStepProps {
  label: string;
  detail?: string;
  state: "complete" | "active" | "waiting" | "muted" | "error";
  last: boolean;
}

export function ChatProcessingStep({ label, detail, state, last }: ChatProcessingStepProps) {
  const color =
    state === "complete" || state === "active"
      ? "text-foundy-primary-ink"
      : state === "error"
        ? "text-red-700"
        : "text-neutral-600";

  return (
    <li className={`relative flex gap-3 ${last ? "" : "pb-4"}`}>
      {!last && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-2 top-5 w-px bg-neutral-200"
        />
      )}
      <span
        aria-hidden="true"
        className={`relative z-[1] mt-0.5 flex size-4 shrink-0 items-center justify-center bg-white ${color}`}
      >
        {state === "complete" ? (
          <svg viewBox="0 0 16 16" fill="none" className="size-4">
            <path
              d="m3.5 8 3 3 6-6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : state === "active" ? (
          <span className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
        ) : (
          <span className="size-2 rounded-full border border-solid border-current" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium leading-5 text-neutral-800">{label}</p>
        {detail && (
          <p className="mb-0 mt-1 whitespace-pre-line break-words text-sm leading-6 text-neutral-600">
            {detail}
          </p>
        )}
      </div>
    </li>
  );
}
