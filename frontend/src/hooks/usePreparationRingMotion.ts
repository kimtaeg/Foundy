"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface RingFrame {
  progress: number;
  segments: { label: string; length: number }[];
}

const DURATION_MS = 420;
const sameStages = (left: RingFrame, right: RingFrame) =>
  left.segments.length === right.segments.length &&
  left.segments.every((segment, index) => segment.label === right.segments[index].label);

/** Animate geometry together; new updates continue from the last painted frame. */
export function usePreparationRingMotion(progress: number, segments: RingFrame["segments"]) {
  // A parent can supply equivalent stage objects on every store update.
  const signature = JSON.stringify({ progress, segments: segments.map(({ label, length }) => ({ label, length })) });
  const target = useMemo(() => JSON.parse(signature) as RingFrame, [signature]);
  const [frame, setFrame] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const from = current.current;
    const startedAt = performance.now();
    let animation = 0;
    const commit = (next: RingFrame) => {
      current.current = next;
      setFrame(next);
    };
    const finish = () => {
      cancelAnimationFrame(animation);
      commit(target);
    };
    const tick = (now: number) => {
      const elapsed = Math.min(1, Math.max(0, (now - startedAt) / DURATION_MS));
      if (elapsed === 1) {
        commit(target);
        return;
      }
      const eased = 1 - (1 - elapsed) ** 3;
      commit({
        progress: from.progress + (target.progress - from.progress) * eased,
        segments: target.segments.map((segment, index) => ({
          label: segment.label,
          length: from.segments[index].length + (segment.length - from.segments[index].length) * eased,
        })),
      });
      animation = requestAnimationFrame(tick);
    };
    if (media.matches || !sameStages(from, target) || JSON.stringify(from) === signature) finish();
    else animation = requestAnimationFrame(tick);

    const onMotionChange = () => { if (media.matches) finish(); };
    media.addEventListener("change", onMotionChange);
    return () => {
      cancelAnimationFrame(animation);
      media.removeEventListener("change", onMotionChange);
    };
  }, [target, signature]);

  return sameStages(frame, target) ? frame : target;
}
