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
  ex: boolean;
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
export type NearbyShopsAvailability = "loading" | "ready" | "location" | "unavailable";
export type NearbyShopsStatus = NearbyShopsAvailability | "error";
export interface NearbyShopsResult {
  shops: Shop[];
  truncated: boolean;
}
export type NearbyShopsSource = (center: MarketPoint, radius: number) => Promise<NearbyShopsResult>;

export type MarketCategory = "all" | "카페" | "음식점";
export type MarketPanelTab = "summary" | "population" | "shops" | "planning";
export interface MarketAnalysis {
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
  /** The initial center already represents the geocoded store address. */
  addressResolved?: boolean;
  shops: Shop[];
  initialCenter: MarketPoint;
  price: string;
  priceRange: PriceRange;
  pricePosition: PricePosition;
}

export interface SitesDataServices {
  appKey?: string;
  nearbyShopsSource?: NearbyShopsSource;
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
