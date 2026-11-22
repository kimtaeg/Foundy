export interface PopulationRadiusProps {
  radius: number;
  onChange: (radius: number) => void;
}

export function PopulationRadius({ radius, onChange }: PopulationRadiusProps) {
  const kilometers = radius >= 1000;
  const distance = kilometers ? radius / 1000 : radius;
  const unit = kilometers ? "km" : "m";

  return (
    <section className="border-0 border-t border-solid border-neutral-200 py-4" aria-label="분석 반경 설정">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="traffic-radius" className="text-base font-semibold tracking-tight text-neutral-900">분석 반경</label>
        <output htmlFor="traffic-radius" className="font-semibold tabular-nums">
          <span className="text-2xl tracking-tight text-neutral-900">{distance}</span>
          <span className="ml-1 text-sm text-neutral-600">{unit}</span>
        </output>
      </div>
      <input
        id="traffic-radius"
        aria-valuetext={`${distance}${unit}`}
        className="m-0 block h-8 w-full cursor-pointer accent-foundy-primary focus-visible:outline-foundy-primary"
        type="range" min={250} max={2000} step={250} value={radius} onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="mt-1 flex gap-1.5" role="group" aria-label="반경 빠른 선택">
        {[500, 1000, 2000].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={value === radius}
            onClick={() => onChange(value)}
            className="min-h-9 flex-1 cursor-pointer rounded-md border-0 bg-neutral-100 px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 aria-pressed:bg-foundy-primary/10 aria-pressed:font-semibold aria-pressed:text-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-foundy-primary"
          >
            {value < 1000 ? `${value}m` : `${value / 1000}km`}
          </button>
        ))}
      </div>
    </section>
  );
}
