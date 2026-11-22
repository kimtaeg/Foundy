/** Existing public-data snapshot at an explicit reference location, not a store geocode. */
export interface DashboardPopulationSnapshot {
  label: string;
  radius: number;
  /** YYYYMMDD from the source files, never the page render date. */
  sourceDate: string;
  sourceLabel: string;
  hourly: {
    hour: number;
    /** Public sum within the radius; missing or fully suppressed values stay null. */
    value: number | null;
    partial: boolean;
  }[];
  /** Highest published hourly sum; this is not a measured visitor peak. */
  peak: { hour: number; value: number; partial: boolean } | null;
}
