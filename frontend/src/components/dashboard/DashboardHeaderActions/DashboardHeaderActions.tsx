import { Element } from "@/components/view/Element";

export interface DashboardHeaderActionsProps { undecided: boolean }

const outlineButtonClasses = "inline-flex min-h-11.5 items-center justify-center gap-1.5 whitespace-nowrap border border-solid border-neutral-300 bg-white px-5 text-[15px] font-medium text-neutral-800 hover:border-foundy-primary hover:text-foundy-primary-ink motion-reduce:transition-none";

export function DashboardHeaderActions({ undecided }: DashboardHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 [&>button]:min-h-11">
      {undecided ? (
        <Element as="button" className="nx-btn" data-nx="go" data-p="sites">상권 분석 보기</Element>
      ) : (
        <>
          <Element as="button" className="nx-btn" data-nx="go" data-p="report">점검 리포트</Element>
          <Element as="button" className={outlineButtonClasses} data-nx="go" data-p="sites">상권 분석</Element>
        </>
      )}
      <Element as="button" className={outlineButtonClasses} data-nx="askchat" data-q="오늘 뭐부터 하죠?">AI에게 오늘 할 일 묻기</Element>
    </div>
  );
}
