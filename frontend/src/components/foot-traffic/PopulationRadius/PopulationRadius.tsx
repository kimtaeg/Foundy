export interface PopulationRadiusProps { radius: number; onChange: (radius: number) => void }

export function PopulationRadius({ radius, onChange }: PopulationRadiusProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="traffic-radius" className="text-sm font-medium text-neutral-600">분석 반경</label>
        <b className="text-sm tabular-nums">{radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}</b>
      </div>
      <input id="traffic-radius" className="m-0 h-4 w-full accent-foundy-primary" type="range" min={250} max={2000} step={250} value={radius} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="mt-2 flex gap-1.5" role="group" aria-label="반경 빠른 선택">
        {[500, 1000, 2000].map((value) => (
          <button type="button" key={value} aria-pressed={value === radius} onClick={() => onChange(value)}
            className={`flex-1 rounded-lg border-0 py-1.5 text-sm ${value === radius ? "bg-foundy-primary font-semibold text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {value < 1000 ? `${value}m` : `${value / 1000}km`}
          </button>
        ))}
      </div>
    </div>
  );
}
