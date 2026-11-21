export interface LatLng {
  lat: number;
  lng: number;
}

export type PopType = "local" | "fornLong" | "fornTemp";
export type ViewType = PopType | "all";
export type Category = "type" | "sex" | "age";
export type HourSel = number | "avg";

/** Public sum; partial [sum, public rows, masked rows]; fully masked; missing. */
export type HourValue = number | [number, number, number] | "*" | null;

export interface PopFile {
  type: PopType;
  group?: string;
  ymd: string;
  values: Record<string, HourValue[]>;
}

export interface Quality {
  builtAt: string;
  ymd: string;
  ymdConsistent: boolean;
  boundary: { cells: number };
  types: Partial<Record<PopType, { joinMissing: { cell: string; allSuppressed?: boolean }[] }>>;
}

export interface CellStat {
  sum: number;
  observed: boolean;
  suppressed: number;
  observedHours: number;
  presentHours: number;
}

/** Main / secondary / collector / local / pedestrian road. */
export type Rank = 0 | 1 | 2 | 3 | 4;
export interface RoadPiece {
  cell: string;
  rank: Rank;
  path: LatLng[];
  mid: [number, number];
}
export interface RoadIndex {
  tile: number;
  tiles: string[];
}
export type CrowdLevel = 1 | 2 | 3 | 4 | 5;
export type PopulationCuts = readonly [number, number, number, number];

/** Original public cell value. Null means masked, while public zero stays zero. */
export interface PopulationRoad extends RoadPiece {
  value: number | null;
  lv: 0 | CrowdLevel;
}

/** JSON data accepted directly by the map, without a browser store or fetch. */
export interface FootTrafficDataset {
  populations: Record<string, PopFile>;
  roads: RoadPiece[];
  quality: Quality | null;
}

/** Implement these functions with your API client to use remote map data. */
export interface FootTrafficDataSource {
  loadPopulation(name: string): Promise<PopFile>;
  loadQuality(): Promise<Quality | null>;
  loadRoads(center: LatLng, radius: number): Promise<RoadPiece[]>;
}
