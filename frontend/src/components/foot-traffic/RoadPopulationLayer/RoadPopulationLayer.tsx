import { useRoadPopulationOverlay } from "@/hooks/useRoadPopulationOverlay";
import type { LatLng, PopulationCuts, PopulationRoad } from "@/types/foot-traffic";

export interface RoadPopulationLayerProps {
  lines: PopulationRoad[];
  cuts: PopulationCuts;
  level: number;
  activeCell: string | null;
  onHover: (value: { cell: string; pos: LatLng } | null) => void;
  onHitTestChange?: (hitTest: ((position: LatLng) => string | null) | null) => void;
}

export function RoadPopulationLayer(props: RoadPopulationLayerProps) {
  useRoadPopulationOverlay(props);
  return null;
}
