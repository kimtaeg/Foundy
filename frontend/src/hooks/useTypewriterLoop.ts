"use client";

import { useEffect, useMemo, useState } from "react";

export interface TypewriterLoopOptions {
  texts: readonly string[];
  paused?: boolean;
  typingMs?: number;
  deletingMs?: number;
  holdMs?: number;
}

interface Frame {
  key: string;
  index: number;
  visible: number;
  phase: "holding" | "deleting" | "typing";
}

function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

const delay = (value: number, fallback: number) => Math.max(16, Number.isFinite(value) ? value : fallback);

/** A completed first message keeps server rendering and reduced-motion reading stable. */
export function useTypewriterLoop({
  texts,
  paused = false,
  typingMs = 55,
  deletingMs = 30,
  holdMs = 2200,
}: TypewriterLoopOptions) {
  // Equal content may arrive in a freshly created props array on every parent render.
  const key = JSON.stringify(texts.filter((text) => text.length > 0));
  const messages = useMemo(() => (JSON.parse(key) as string[]).map(graphemes), [key]);
  const initial = useMemo<Frame>(() => ({ key, index: 0, visible: messages[0]?.length ?? 0, phase: "holding" }), [key, messages]);
  const [stored, setFrame] = useState(initial);
  const [environment, setEnvironment] = useState({ ready: false, reducedMotion: false, visible: true });
  const frame = stored.key === key ? stored : initial;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnvironment({ ready: true, reducedMotion: media.matches, visible: document.visibilityState !== "hidden" });
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    setFrame(initial);
  }, [initial, environment.reducedMotion]);

  const isAnimating = environment.ready && environment.visible && !environment.reducedMotion && !paused && messages.length > 1;
  useEffect(() => {
    if (!isAnimating) return;
    const duration = frame.phase === "holding"
      ? delay(holdMs, 2200)
      : frame.phase === "deleting" ? delay(deletingMs, 30) : delay(typingMs, 55);
    const timer = window.setTimeout(() => {
      setFrame((previous) => {
        if (previous.key !== key) return initial;
        if (previous.phase === "holding") return { ...previous, visible: Math.max(0, previous.visible - 1), phase: "deleting" };
        if (previous.phase === "deleting") {
          return previous.visible > 0
            ? { ...previous, visible: previous.visible - 1 }
            : { key, index: (previous.index + 1) % messages.length, visible: 0, phase: "typing" };
        }
        const visible = previous.visible + 1;
        return { ...previous, visible, phase: visible >= messages[previous.index].length ? "holding" : "typing" };
      });
    }, duration);
    return () => window.clearTimeout(timer);
  }, [frame, initial, isAnimating, messages, key, typingMs, deletingMs, holdMs]);

  const text = environment.reducedMotion
    ? messages[0]?.join("") ?? ""
    : messages[frame.index]?.slice(0, frame.visible).join("") ?? "";
  return { text, isAnimating, reducedMotion: environment.reducedMotion };
}
