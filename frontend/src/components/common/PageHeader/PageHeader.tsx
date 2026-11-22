import { ReactNode } from "react";

export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  notice?: ReactNode;
  actions?: ReactNode;
  actionsLayout?: "responsive" | "inline";
  breadcrumbLabel?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  notice,
  actions,
  actionsLayout = "responsive",
  breadcrumbLabel = title,
}: PageHeaderProps) {
  const inline = actionsLayout === "inline";
  return (
    <header data-page-header={eyebrow} className="mb-5 border-0 border-b border-solid border-neutral-200 pb-6 sm:mb-5 sm:pb-7">
      {notice}
      <nav aria-label="현재 위치" className="mb-5">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-xs leading-6 text-neutral-500 sm:text-sm">
          <li>
            <a href="/dashboard" className="inline-flex min-h-8 items-center gap-1.5 rounded-md transition-colors hover:text-foundy-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9" /></svg>
              홈
            </a>
          </li>
          <li aria-hidden="true" className="flex text-neutral-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </li>
          <li aria-current="page" className="font-medium text-neutral-700">{breadcrumbLabel}</li>
        </ol>
      </nav>
      <div className={inline ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 lg:flex lg:items-end lg:justify-between lg:gap-8" : "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8"}>
        <div className={inline ? "contents lg:block lg:min-w-0" : "min-w-0"}>
          <h1 className="m-0 break-words text-[28px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[34px]">
            {title}
          </h1>
          <p className="col-span-full mb-0 mt-3 max-w-2xl text-sm leading-relaxed text-neutral-500 sm:text-base">
            {description}
          </p>
        </div>
        {actions && <div className="col-start-2 row-start-1 shrink-0 [&>div]:flex-wrap">{actions}</div>}
      </div>
    </header>
  );
}
