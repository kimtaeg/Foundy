/** Shared visual states for a destination and a navigation-group trigger. */
export function navigationItemClasses(active: boolean) {
  return `relative inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[10px] border-0 px-2 py-2.5 text-base font-semibold leading-5 whitespace-nowrap transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary min-[360px]:px-3 sm:px-5 [-webkit-tap-highlight-color:transparent] ${active ? "bg-neutral-100 text-foundy-primary-ink" : "bg-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"}`;
}
