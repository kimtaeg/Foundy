export interface LogoProps {
  onHome: () => void;
}
export function Logo({ onHome }: LogoProps) {
  return (
    <button
      type="button"
      onClick={onHome}
      aria-label="Foundy 홈"
      className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border-0 bg-transparent p-0 text-neutral-800 outline-offset-4 focus-visible:outline-2 focus-visible:outline-foundy-primary"
    >
      <span className="text-[22px] sm:text-[25px] leading-none font-bold tracking-[-1.3px]">
        FOUNDY
      </span>
    </button>
  );
}
