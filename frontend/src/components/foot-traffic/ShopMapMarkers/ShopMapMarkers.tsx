import { CustomOverlayMap } from "react-kakao-maps-sdk";
import { useState } from "react";
import type { Shop } from "@/types/market";

export interface ShopMapMarkersProps { shops: Shop[]; selectedId: string | null; onSelect: (id: string) => void }

export function ShopMapMarkers({ shops, selectedId, onSelect }: ShopMapMarkersProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  return shops.map((shop) => {
    const selected = selectedId === shop.id;
    return (
      <CustomOverlayMap key={shop.id} position={{ lat: shop.lat, lng: shop.lng }} zIndex={selected ? 16 : focusedId === shop.id ? 15 : 12} clickable yAnchor={selected ? 1 : 0.5}>
        <button type="button" aria-label={`${shop.name}, ${Math.round(shop.dist)}m`} aria-pressed={selected} onClick={() => onSelect(shop.id)}
          onMouseEnter={() => setFocusedId(shop.id)} onMouseLeave={() => setFocusedId(null)} onFocus={() => setFocusedId(shop.id)} onBlur={() => setFocusedId(null)}
          className={`group relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg text-sm ${selected ? "border border-solid border-foundy-primary bg-foundy-primary px-3 py-1.5 font-bold text-white" : "border-0 bg-transparent p-0 text-neutral-700"}`}>
          <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${selected ? "h-1.5 w-1.5 bg-white" : "h-3 w-3 border-2 border-solid border-white bg-foundy-primary ring-1 ring-foundy-primary/30"}`} />
          {selected ? <>{shop.name}<span className="text-xs font-normal">{Math.round(shop.dist)}m</span></>
            : <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-solid border-neutral-200 bg-white px-2 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{shop.name}</span>}
        </button>
      </CustomOverlayMap>
    );
  });
}
