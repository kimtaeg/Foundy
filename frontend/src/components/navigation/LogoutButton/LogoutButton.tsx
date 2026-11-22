export interface LogoutButtonProps {
  onLogout: () => void;
}
export function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <button
      type="button"
      data-nx="logout"
      onClick={onLogout}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-1.5 py-2.5 text-sm leading-5 font-medium text-red-500 transition-colors hover:bg-neutral-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-foundy-primary sm:px-2"
    >
      로그아웃
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M9 12h12m-4-4 4 4-4 4" />
      </svg>
    </button>
  );
}
