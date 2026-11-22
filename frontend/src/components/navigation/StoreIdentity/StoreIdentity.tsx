export interface StoreIdentityProps {
  name: string;
  onOpen: () => void;
}
export function StoreIdentity({ name, onOpen }: StoreIdentityProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name}, 가게 정보 열기`}
      className="flex max-w-[90px] cursor-pointer items-center gap-2 rounded-xl border-0 px-2.5 py-2 text-neutral-700 transition-colors bg-transparent hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-foundy-primary sm:max-w-[158px] sm:px-3"
    >
      {/* <span
        aria-hidden="true"
        className="hidden size-7 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-extrabold sm:flex"
      >
        {name.slice(0, 1)}
      </span> */}
      <span className="truncate text-sm leading-5 font-bold">
        {name}
      </span>
      <svg
        aria-hidden="true"
        className="shrink-0 text-neutral-600"
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="m6 4 4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
