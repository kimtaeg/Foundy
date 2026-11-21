export interface MapZoomControlsProps { level: number; onChange: (level: number) => void }

export function MapZoomControls({ level, onChange }: MapZoomControlsProps) {
  return (
    <div role="group" aria-label="지도 확대와 축소" data-map-level={level} className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 overflow-hidden rounded-xl border border-solid border-neutral-200 bg-white">
      <button type="button" aria-label="지도 확대" disabled={level <= 1} onClick={() => onChange(Math.max(1, level - 1))}
        className="flex h-11 w-11 items-center justify-center border-0 border-r border-solid border-neutral-200 bg-white text-xl text-neutral-700 hover:bg-neutral-50 disabled:cursor-default disabled:text-neutral-600">
        <span aria-hidden="true">+</span>
      </button>
      <button type="button" aria-label="지도 축소" disabled={level >= 14} onClick={() => onChange(Math.min(14, level + 1))}
        className="flex h-11 w-11 items-center justify-center border-0 bg-white text-xl text-neutral-700 hover:bg-neutral-50 disabled:cursor-default disabled:text-neutral-600">
        <span aria-hidden="true">−</span>
      </button>
    </div>
  );
}
