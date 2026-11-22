import { useRef } from "react";
import type { Category, HourSel } from "@/types/foot-traffic";
import { PopulationCategory } from "../PopulationCategory";
import { PopulationCategoryTabs } from "../PopulationCategoryTabs";
import { PopulationRadius } from "../PopulationRadius";
import { PopulationTime } from "../PopulationTime";

export interface MapControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category; sub: string; hour: HourSel; lastHour: number;
  radius: number; shown: boolean; region: string;
  onCategoryChange: (category: Category) => void;
  onSubChange: (sub: string) => void;
  onHourChange: (hour: HourSel) => void;
  onRadiusChange: (radius: number) => void;
  onToggle: () => void;
}

export function MapControls(props: MapControlsProps) {
  const { open, onOpenChange } = props;
  const toggleButton = useRef<HTMLButtonElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  return (
    <>
      <button ref={toggleButton} type="button" aria-expanded={open} aria-controls="traffic-controls" onClick={() => onOpenChange(!open)}
        className="absolute left-3 top-3 z-20 min-h-11 cursor-pointer rounded-xl border border-solid border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 focus-visible:outline-2 focus-visible:outline-foundy-primary lg:hidden">
        {open ? "설정 닫기" : "지도 설정"}
      </button>
      <aside id="traffic-controls" aria-label="생활인구 지도 설정" data-open={open}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            onOpenChange(false);
            toggleButton.current?.focus();
          }
        }}
        className="map-disclosure absolute bottom-20 left-3 top-16 z-20 flex w-[min(300px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white lg:bottom-auto lg:left-4 lg:top-4 lg:max-h-[calc(60%-2rem)]">
        <header className="shrink-0 px-5 pb-4 pt-5">
          <h2 className="mb-1 mt-1 text-lg font-bold tracking-tight text-neutral-900">생활인구 분석</h2>
          <p className="m-0 text-sm leading-relaxed text-neutral-600">{props.region || "지도를 클릭해 분석 위치를 선택하세요"}</p>
        </header>
        <div className="shrink-0 px-5 pb-3">
          <PopulationCategoryTabs category={props.category} onChange={(category) => {
            props.onCategoryChange(category);
            scrollArea.current?.scrollTo({ top: 0 });
          }} />
        </div>
        <div ref={scrollArea} className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
          <PopulationCategory category={props.category} sub={props.sub} onSubChange={props.onSubChange} />
          <PopulationTime hour={props.hour} lastHour={props.lastHour} onChange={props.onHourChange} />
          <PopulationRadius radius={props.radius} onChange={props.onRadiusChange} />
          <button
            type="button"
            aria-pressed={props.shown}
            onClick={props.onToggle}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-solid border-foundy-primary bg-foundy-primary px-3 text-sm font-semibold text-white hover:bg-foundy-primary-ink aria-pressed:border-neutral-300 aria-pressed:bg-white aria-pressed:text-neutral-800 aria-pressed:hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="2.5" />
              {props.shown && <path d="m3 3 18 18" />}
            </svg>
            {props.shown ? "생활인구 숨기기" : "생활인구 보기"}
          </button>
        </div>
      </aside>
    </>
  );
}
