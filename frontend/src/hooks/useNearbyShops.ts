"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketPoint, NearbyShopsAvailability, NearbyShopsResult, NearbyShopsSource, NearbyShopsStatus } from "@/types/market";

interface SearchResult {
  source: NearbyShopsSource;
  key: string;
  attempt: number;
  data?: NearbyShopsResult;
}

export function useNearbyShops(source: NearbyShopsSource | undefined, availability: NearbyShopsAvailability, center: MarketPoint, radius: number) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SearchResult>();
  const cache = useRef(new Map<string, NearbyShopsResult>());
  const { lat, lng } = center;
  const key = `${lat},${lng},${radius}`;

  useEffect(() => { cache.current.clear(); }, [source]);
  useEffect(() => {
    if (!source || availability !== "ready") return;
    let current = true;
    const timer = window.setTimeout(() => {
      const cached = cache.current.get(key);
      if (cached) {
        setResult({ source, key, attempt, data: cached });
        return;
      }
      Promise.resolve().then(() => source({ lat, lng }, radius)).then((data) => {
        if (!current) return;
        if (cache.current.size >= 12) {
          const oldest = cache.current.keys().next().value;
          if (oldest) cache.current.delete(oldest);
        }
        cache.current.set(key, data);
        setResult({ source, key, attempt, data });
      }, () => {
        if (current) setResult({ source, key, attempt });
      });
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [source, availability, key, attempt, lat, lng, radius]);

  const active = result?.source === source && result?.key === key && result?.attempt === attempt ? result : undefined;
  const status: NearbyShopsStatus = availability !== "ready" ? availability : !active ? "loading" : active.data ? "ready" : "error";
  return {
    status,
    data: availability === "ready" ? active?.data : undefined,
    retry: () => setAttempt((previous) => previous + 1),
  };
}
