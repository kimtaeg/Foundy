import type { LatLng, PopulationCuts, PopulationRoad, Rank } from "@/types/foot-traffic";
import { populationColor, SUPPRESSED } from "./levels";

export interface RoadGradientSegment {
  cell: string;
  rank: Rank;
  from: LatLng;
  to: LatLng;
  fromColor: string;
  toColor: string;
}

// Source road coordinates use six decimal places. Shared vertices get one color.
const vertexKey = ({ lat, lng }: LatLng) => `${Math.round(lat * 1e6)}:${Math.round(lng * 1e6)}`;

/** Visual boundary blending only; source cell values and tooltip numbers stay untouched. */
export function roadGradientSegments(roads: readonly PopulationRoad[], cuts: PopulationCuts): RoadGradientSegment[] {
  const junctions = new Map<string, Map<string, number>>();
  for (const road of roads) {
    if (road.value === null) continue;
    for (const point of road.path) {
      const key = vertexKey(point);
      let values = junctions.get(key);
      if (!values) junctions.set(key, values = new Map());
      values.set(road.cell, road.value);
    }
  }
  const junctionColors = new Map<string, string>();
  for (const [key, values] of junctions) {
    junctionColors.set(key, populationColor([...values.values()].reduce((sum, value) => sum + value, 0) / values.size, cuts));
  }
  const result: RoadGradientSegment[] = [];
  for (const road of roads) {
    const ownColor = road.value === null ? SUPPRESSED.color : populationColor(road.value, cuts);
    for (let i = 1; i < road.path.length; i++) {
      const from = road.path[i - 1], to = road.path[i];
      if (from.lat === to.lat && from.lng === to.lng) continue;
      const fromColor = road.value === null ? ownColor : junctionColors.get(vertexKey(from)) ?? ownColor;
      const toColor = road.value === null ? ownColor : junctionColors.get(vertexKey(to)) ?? ownColor;
      const base = { cell: road.cell, rank: road.rank };
      if (fromColor === ownColor && toColor === ownColor) {
        result.push({ ...base, from, to, fromColor, toColor });
      } else {
        // Preserve an anchor of the original cell color between shared boundaries.
        const middle = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
        result.push({ ...base, from, to: middle, fromColor, toColor: ownColor });
        result.push({ ...base, from: middle, to, fromColor: ownColor, toColor });
      }
    }
  }
  return result;
}
