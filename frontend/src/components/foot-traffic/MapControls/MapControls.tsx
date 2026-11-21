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
        className="absolute left-3 top-3 z-20 rounded-xl border border-solid border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 lg:hidden">
        {open ? "설정 닫기" : "지도 설정"}
      </button>
      <aside id="traffic-controls" aria-label="생활인구 지도 설정"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            onOpenChange(false);
            toggleButton.current?.focus();
          }
        }}
        className={`absolute bottom-20 left-3 top-16 z-20 w-[min(300px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white lg:bottom-auto lg:left-4 lg:top-4 lg:max-h-[calc(60%-2rem)] ${open ? "flex" : "hidden lg:flex"}`}>
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
        <div ref={scrollArea} className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain px-5 pb-5">
          <PopulationCategory category={props.category} sub={props.sub} onSubChange={props.onSubChange} />
          <PopulationTime hour={props.hour} lastHour={props.lastHour} onChange={props.onHourChange} />
          <PopulationRadius radius={props.radius} onChange={props.onRadiusChange} />
          <button type="button" aria-pressed={props.shown} onClick={props.onToggle} className="rounded-xl border-0 bg-foundy-primary px-4 py-3 text-sm font-semibold text-white hover:brightness-95">
            {props.shown ? "생활인구 숨기기" : "생활인구 보기"}
          </button>
        </div>
      </aside>
    </>
  );
}
