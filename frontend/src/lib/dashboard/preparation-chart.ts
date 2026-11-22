import type { DashboardStageProgress } from "@/types/dashboard";

const colors = [
  "rgb(11 85 84)",
  "rgb(16 126 125)",
  "rgb(82 169 166)",
  "rgb(161 207 202)",
] as const;
const stageColors: Record<string, string> = {
  "계약 전": colors[0],
  "개업 4주 전": colors[1],
  "개업 직전": colors[2],
  "개업 후": colors[3],
};

/** A stage keeps the same color in the ring and list, even when its order changes. */
export function preparationStageColor(label: string, index: number) {
  return stageColors[label] ?? colors[index % colors.length];
}

/** Completed stage counts stack contiguously against the same global task total. */
export function buildPreparationRingSegments(stages: readonly DashboardStageProgress[], count: { done: number; total: number }) {
  const valid = stages.every(({ done, total }) => Number.isFinite(done) && Number.isFinite(total) && total >= 0 && done >= 0 && done <= total);
  const total = stages.reduce((sum, stage) => sum + stage.total, 0);
  const done = stages.reduce((sum, stage) => sum + stage.done, 0);
  // Old API responses may omit stages; inconsistent aggregates must not draw a misleading breakdown.
  if (!valid || total <= 0 || total !== count.total || done !== count.done) return [];

  const nonempty = stages.map((stage, index) => ({ ...stage, color: preparationStageColor(stage.label, index) })).filter((stage) => stage.total > 0);
  let offset = 0;
  return nonempty.map((stage) => {
    const length = stage.done / total * 100;
    const segment = { ...stage, offset, length };
    offset += length;
    return segment;
  });
}

/** Blend only near shared boundaries, leaving each stage's main color visible. */
export function buildPreparationRingTransitions(segments: readonly { offset: number; length: number; color: string }[], closed = false) {
  const visible = segments.filter((segment) => segment.length > 0);
  if (visible.length < 2) return [];
  return visible.flatMap((previous, index) => {
    const wraps = index === visible.length - 1 && closed;
    const next = visible[index + 1] ?? (wraps ? visible[0] : undefined);
    if (!next || previous.color === next.color) return [];
    const halfWidth = Math.min(4, previous.length * 0.35, next.length * 0.35);
    return [{
      offset: (wraps ? 100 : previous.offset + previous.length) - halfWidth,
      length: halfWidth * 2,
      from: previous.color,
      to: next.color,
    }];
  });
}
