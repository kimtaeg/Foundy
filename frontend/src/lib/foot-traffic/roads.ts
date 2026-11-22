import type { LatLng, Rank, RoadIndex, RoadPiece } from "@/types/foot-traffic";
import { utmk } from "./coordinates";
import { fetchData } from "./data-loader";

let indexPromise: Promise<RoadIndex> | null = null;
const tileCache = new Map<string, Promise<RoadPiece[]>>();

export function loadRoadIndex(): Promise<RoadIndex> {
  indexPromise ??= fetchData<RoadIndex>("roads/index.json").then((index) => {
    if (!Number.isFinite(index.tile) || index.tile <= 0 || !Array.isArray(index.tiles)) {
      throw new Error("도로 데이터의 타일 정보를 확인할 수 없어요.");
    }
    return index;
  }).catch((error: unknown) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

function loadTile(key: string): Promise<RoadPiece[]> {
  const cached = tileCache.get(key);
  if (cached) return cached;
  const request = fetchData<[string, Rank, number[]][]>(`roads/${key}.json`)
    .then((items) => items.map(([cell, rank, flat]) => {
      if (flat.length < 4 || flat.length % 2) throw new Error("도로 좌표 데이터가 올바르지 않아요.");
      const path: LatLng[] = [];
      for (let i = 0; i < flat.length; i += 2) path.push({ lat: flat[i], lng: flat[i + 1] });
      return { cell, rank, path, mid: utmk(path[path.length >> 1]) };
    })).catch((error: unknown) => {
      tileCache.delete(key);
      throw error;
    });
  tileCache.set(key, request);
  return request;
}

/** Fetch only available 1 km tiles, then retain pieces whose midpoint is in the radius. */
export async function roadsInRadius(center: LatLng, radius: number): Promise<RoadPiece[]> {
  if (!Number.isFinite(radius) || radius <= 0 || radius > 2000 ||
      !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return [];
  const index = await loadRoadIndex();
  const available = new Set(index.tiles);
  const [cx, cy] = utmk(center);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return [];
  const keys: string[] = [];
  for (let x = Math.floor((cx - radius) / index.tile); x <= Math.floor((cx + radius) / index.tile); x++) {
    for (let y = Math.floor((cy - radius) / index.tile); y <= Math.floor((cy + radius) / index.tile); y++) {
      const key = `${x}_${y}`;
      if (available.has(key)) keys.push(key);
    }
  }
  const tiles = await Promise.all(keys.map(loadTile));
  return tiles.flat().filter((piece) =>
    (piece.mid[0] - cx) ** 2 + (piece.mid[1] - cy) ** 2 <= radius ** 2);
}

export function maxRankForLevel(level: number): Rank {
  if (level >= 7) return 0;
  if (level === 6) return 1;
  if (level === 5) return 2;
  if (level === 4) return 3;
  return 4;
}

const WEIGHTS: Record<number, number[]> = {
  3: [12, 11, 10, 8, 5], 4: [10, 9, 8, 6, 4], 5: [8, 7, 6, 4, 3],
  6: [6, 5, 4, 3, 2], 7: [5, 4, 3, 2, 2],
};
export const strokeWeight = (rank: Rank, level: number) =>
  WEIGHTS[Math.min(7, Math.max(3, Math.round(level)))][rank];
