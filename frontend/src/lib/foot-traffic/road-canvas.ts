import type { LatLng } from "@/types/foot-traffic";
import type { RoadGradientSegment } from "./road-gradient";
import { strokeWeight } from "./roads";

interface Point { x: number; y: number }
export interface ProjectedRoadSegment {
  cell: string;
  from: Point;
  to: Point;
  width: number;
}

/** One opaque canvas composited once, so shared round caps do not darken junctions. */
export function paintRoadCanvas(
  context: CanvasRenderingContext2D,
  segments: readonly RoadGradientSegment[],
  project: (position: LatLng) => Point,
  level: number,
  activeCell: string | null,
  width: number,
  height: number,
): ProjectedRoadSegment[] {
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  const projected: ProjectedRoadSegment[] = [];
  for (const segment of segments) {
    const from = project(segment.from), to = project(segment.to);
    const weight = strokeWeight(segment.rank, level) + (activeCell === segment.cell ? 2 : 0);
    if (Math.max(from.x, to.x) < -weight || Math.min(from.x, to.x) > width + weight ||
        Math.max(from.y, to.y) < -weight || Math.min(from.y, to.y) > height + weight) continue;
    const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
    gradient.addColorStop(0, segment.fromColor);
    gradient.addColorStop(1, segment.toColor);
    context.strokeStyle = gradient;
    context.lineWidth = weight;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    projected.push({ cell: segment.cell, from, to, width: weight });
  }
  return projected;
}

/** Return the original source cell, never an interpolated population value. */
export function hitTestRoad(segments: readonly ProjectedRoadSegment[], point: Point): string | null {
  let nearest = Infinity, cell: string | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    const dx = segment.to.x - segment.from.x, dy = segment.to.y - segment.from.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) / length)) : 0;
    const distance = Math.hypot(point.x - segment.from.x - t * dx, point.y - segment.from.y - t * dy);
    if (distance <= Math.max(5, segment.width / 2 + 1) && distance < nearest) {
      nearest = distance;
      cell = segment.cell;
    }
  }
  return cell;
}
