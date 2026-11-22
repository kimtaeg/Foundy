"use client";

import { useEffect, useState } from "react";

/** Measures the current request; completed requests use their recorded finish time. */
export function useChatElapsed(startedAt: number, finishedAt?: number) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    if (finishedAt !== undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt, finishedAt]);

  return Math.max(0, ((finishedAt ?? now) - startedAt) / 1000);
}
