import type { ChangeEventHandler } from "react";
import type { FootTrafficDataset, FootTrafficDataSource, HourSel } from "./foot-traffic";
import type { PopulationDataset, PopulationInsights, PopulationInsightsDataSource } from "./population-insights";
import type { DataState } from "./data-state";

export interface Shop {
  id: string;
  name: string;
  dist: number;
  lng: number;
  lat: number;
  sub: string;
  cat: string;
  /** true 면 시연용 예시 점포, false 면 카카오 지도에서 조회한 실제 점포 */
  ex: boolean;
  /** 카카오맵 장소 페이지 (실제 점포만) */
  url?: string;
}
export interface MarketSelection {
  sel: string | null;
  r: number;
  cat: string;
}
export interface PriceRange {
  min: number;
  median: number;
  max: number;
}
export interface PricePosition {
  txt: string;
  pct: number | null;
  lvl: string;
}
export interface MarketStats {
  fr: Shop[];
  ind: number;
  dessert: Shop[];
  within: (radius: number) => number;
}
export interface SitesContext {
  S: { address: string; detail: string };
  MAP: MarketSelection;
  SHOPS: Shop[];
  EXFOOD: Shop[];
  PRICE: string;
  PRICE_EX: PriceRange;
  density: (count: number) => number;
  compLevel: (density: number) => string;
  mkStats: () => MarketStats;
  pricePos: (price: string) => PricePosition;
  won: (value: number) => string;
}
export interface ChartRow {
  label: string;
  value: number;
  percent: number;
}
export interface StrategyItem {
  text: string;
  source: string;
}

export interface MarketPoint {
  lat: number;
  lng: number;
}
export type MarketCategory = "all" | "카페" | "음식점";
export type MarketPanelTab = "summary" | "population" | "shops" | "planning";
/** 주변 점포 조회 상태. idle: 아직 시작 전, loading: 조회 중, ready: 조회됨, error: 조회하지 못함 */
export type NearbyShopsStatus = "idle" | "loading" | "ready" | "error";
export interface NearbyShopsState {
  status: NearbyShopsStatus;
  shops: Shop[];
  /** 카카오가 한 번에 주는 양(그룹당 45곳)보다 실제 점포가 더 많아 가까운 일부만 받았을 때 true */
  truncated: boolean;
}
export interface MarketAnalysis {
  /** 시연용 예시 점포로 분석했는지 (지도 키가 없어 실제 조회를 쓰지 못할 때만) */
  example?: boolean;
  status?: NearbyShopsStatus;
  truncated?: boolean;
  nearby: Shop[];
  count: number;
  density: number | null;
  franchiseCount: number;
  franchisePercent: number | null;
  independentCount: number;
  dessertCount: number;
  composition: ChartRow[];
  distanceRows: ChartRow[];
}

/** Serializable page data; event handlers and request functions are separate props. */
export interface SitesViewData {
  address: string;
  shops: Shop[];
  initialCenter: MarketPoint;
  price: string;
  priceRange: PriceRange;
  pricePosition: PricePosition;
}

export interface SitesDataServices {
  appKey?: string;
  footTrafficData?: FootTrafficDataset;
  footTrafficSource?: FootTrafficDataSource;
  footTrafficLoading?: boolean;
  footTrafficError?: string | null;
  onFootTrafficRetry?: () => void;
  populationData?: PopulationDataset;
  populationSource?: PopulationInsightsDataSource;
  /** Already computed API response; may be a stable Promise for Suspense. */
  populationInsights?: DataState<PopulationInsights | null>;
  onAnalysisChange?: (selection: SitesAnalysisSelection) => void;
  onPriceChange?: ChangeEventHandler<HTMLInputElement>;
  onOpenReport?: () => void;
}

export interface SitesAnalysisSelection {
  center: MarketPoint;
  radius: number;
  category: MarketCategory;
  hour: HourSel;
}
