import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useMap } from "react-kakao-maps-sdk";
import { roadGradientSegments } from "@/lib/foot-traffic/road-gradient";
import { hitTestRoad, paintRoadCanvas, type ProjectedRoadSegment } from "@/lib/foot-traffic/road-canvas";
import { LINE_OPACITY } from "@/lib/foot-traffic/levels";
import type { LatLng, PopulationCuts, PopulationRoad } from "@/types/foot-traffic";

type HitTest = (position: LatLng) => string | null;
interface Options {
  lines: PopulationRoad[];
  cuts: PopulationCuts;
  level: number;
  activeCell: string | null;
  onHover: (value: { cell: string; pos: LatLng } | null) => void;
  onHitTestChange?: (hitTest: HitTest | null) => void;
}

/** SDK adapter: map-relative projection, lifecycle, redraw scheduling and pointer lookup. */
export function useRoadPopulationOverlay({ lines, cuts, level, activeCell, onHover, onHitTestChange }: Options) {
  const map = useMap("RoadPopulationLayer");
  const segments = useMemo(() => roadGradientSegments(lines, cuts), [lines, cuts]);
  const scene = useRef({ segments, level, activeCell, onHover });
  const repaint = useRef<(() => void) | null>(null);
  const hitTest = useRef<HitTest | null>(null);

  useLayoutEffect(() => {
    scene.current = { segments, level, activeCell, onHover };
    repaint.current?.();
  }, [segments, level, activeCell, onHover]);

  useEffect(() => {
    onHitTestChange?.((position) => hitTest.current?.(position) ?? null);
    return () => onHitTestChange?.(null);
  }, [onHitTestChange]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.dataset.testid = "road-population-canvas";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", opacity: String(LINE_OPACITY), zIndex: "2" });
    const context = canvas.getContext("2d");
    if (!context) return;
    const node = map.getNode();
    let frame = 0, dragging = false, disposed = false;
    let origin = { x: 0, y: 0 };
    let projected: ProjectedRoadSegment[] = [];

    class PopulationOverlay extends kakao.maps.AbstractOverlay {
      onAdd() { this.getPanels().overlayLayer.appendChild(canvas); }
      onRemove() { canvas.remove(); }
      draw() {
        if (disposed || frame) return;
        frame = requestAnimationFrame(() => { frame = 0; this.paint(); });
      }
      paint() {
        if (disposed || !this.getMap()) return;
        const padding = 192;
        const width = node.clientWidth + padding * 2, height = node.clientHeight + padding * 2;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const projection = this.getProjection();
        const center = projection.pointFromCoords(map.getCenter());
        origin = { x: center.x - node.clientWidth / 2 - padding, y: center.y - node.clientHeight / 2 - padding };
        canvas.style.left = `${origin.x}px`; canvas.style.top = `${origin.y}px`;
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
        const pixelWidth = Math.ceil(width * ratio), pixelHeight = Math.ceil(height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
        context!.setTransform(ratio, 0, 0, ratio, 0, 0);
        const current = scene.current;
        projected = paintRoadCanvas(context!, current.segments, (position) => {
          const point = projection.pointFromCoords(new kakao.maps.LatLng(position.lat, position.lng));
          return { x: point.x - origin.x, y: point.y - origin.y };
        }, current.level, current.activeCell, width, height);
        canvas.dataset.segmentCount = String(projected.length);
      }
      hit(position: LatLng): string | null {
        const point = this.getProjection().pointFromCoords(new kakao.maps.LatLng(position.lat, position.lng));
        return hitTestRoad(projected, { x: point.x - origin.x, y: point.y - origin.y });
      }
    }
    const overlay = new PopulationOverlay();
    const draw = () => overlay.draw();
    const clearHover = () => scene.current.onHover(null);
    const mousemove = (event: kakao.maps.event.MouseEvent) => {
      if (dragging) return;
      const pos = { lat: event.latLng.getLat(), lng: event.latLng.getLng() };
      const cell = overlay.hit(pos);
      scene.current.onHover(cell ? { cell, pos } : null);
    };
    const dragstart = () => { dragging = true; clearHover(); };
    const dragend = () => { dragging = false; draw(); };
    const listeners: [string, (...args: never[]) => void][] = [
      ["mousemove", mousemove], ["dragstart", dragstart], ["dragend", dragend],
      ["zoom_start", clearHover], ["bounds_changed", draw], ["idle", draw],
    ];
    overlay.setMap(map);
    repaint.current = draw;
    hitTest.current = (position) => overlay.hit(position);
    for (const [name, listener] of listeners) kakao.maps.event.addListener(map, name, listener);
    node.addEventListener("mouseleave", clearHover);
    const resize = new ResizeObserver(draw);
    resize.observe(node);
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      for (const [name, listener] of listeners) kakao.maps.event.removeListener(map, name, listener);
      node.removeEventListener("mouseleave", clearHover);
      repaint.current = null; hitTest.current = null;
      overlay.setMap(null);
    };
  }, [map]);
}
