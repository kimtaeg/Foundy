import type { HourSel, PopFile } from "./foot-traffic";

export type PopulationDisclosure = "public" | "partial" | "masked" | "missing";

export interface PopulationCoverage {
  /** Known dataset cells whose centers are inside the selected radius. */
  cellCount: number;
  observedCells: number;
  suppressedCells: number;
  missingCells: number;
  observedCellHours: number;
  expectedCellHours: number;
  /** Counts refer to file × cell × hour slots, never people. */
  suppressedSourceValues: number;
  missingSourceValues: number;
  expectedSourceValues: number;
}

export interface PopulationMeasure {
  value: number | null;
  status: PopulationDisclosure;
  coverage: PopulationCoverage;
}

export interface PopulationBreakdownRow extends PopulationMeasure {
  key: string;
  label: string;
  /** Percent of the public values in this breakdown, not all actual people. */
  share: number | null;
}

export interface PopulationHourlyPoint {
  hour: number;
  label: string;
  total: PopulationMeasure;
  local: PopulationMeasure;
  foreign: PopulationMeasure;
}

export interface PopulationInsights {
  sourceDate: string;
  sourceDates: string[];
  consistentDate: true;
  hour: HourSel;
  total: PopulationMeasure;
  hourly: PopulationHourlyPoint[];
  types: PopulationBreakdownRow[];
  sex: PopulationBreakdownRow[];
  age: PopulationBreakdownRow[];
  /** Highest public hourly sum; partial means coverage varies or is masked. */
  peak: { hour: number; value: number; partial: boolean } | null;
}

export type PopulationDataset = Record<string, PopFile>;

export interface PopulationInsightsDataSource {
  loadDataset(): Promise<PopulationDataset>;
}
