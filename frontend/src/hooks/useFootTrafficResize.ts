"use client";

import { useEffect, useRef } from "react";
import type { LatLng } from "@/types/foot-traffic";

/** Recenter the selected analysis point only when the map viewport changes size. */
export function useFootTrafficResize(map: kakao.maps.Map | null, center: LatLng) {
  const centerRef = useRef(center);
  useEffect(() => { centerRef.current = center; }, [center.lat, center.lng, center]);
  useEffect(() => {
    if (!map) return;
    let frame = 0;
    const resize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const selected = centerRef.current;
        map.relayout();
        map.setCenter(new kakao.maps.LatLng(selected.lat, selected.lng));
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(map.getNode());
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [map]);
}
