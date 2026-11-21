export interface LogoutButtonProps {
  onLogout: () => void;
}
export function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <button
      type="button"
      data-nx="logout"
      onClick={onLogout}
      className="shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-1.5 py-2.5 text-sm leading-5 font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-foundy-primary sm:px-2"
    >
      로그아웃
    </button>
  );
}
