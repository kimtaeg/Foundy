"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, CustomOverlayMap, Map, useKakaoLoader } from "react-kakao-maps-sdk";
import { useFootTrafficLocation } from "@/hooks/useFootTrafficLocation";
import { useFootTrafficResize } from "@/hooks/useFootTrafficResize";
import { useNearbyShops } from "@/hooks/useNearbyShops";
import { toLevel, type CellStat, type HourSel, type LatLng, type PopulationCuts, type PopulationRoad } from "@/lib/foot-traffic";
import type { NearbyShopsState, Shop } from "@/types/market";
import { MapAvailability } from "../MapAvailability";
import { PopulationTooltip } from "../PopulationTooltip";
import { RoadPopulationLayer } from "../RoadPopulationLayer";
import { ShopMapMarkers } from "../ShopMapMarkers";
import { MapZoomControls } from "../MapZoomControls";

export interface MapCanvasProps {
  appKey: string;
  center: LatLng;
  radius: number;
  level: number;
  lines: PopulationRoad[];
  cells: globalThis.Map<string, CellStat>;
  cuts: PopulationCuts;
  label: string;
  hour: HourSel;
  shops: Shop[];
  selectedShopId: string | null;
  address?: string;
  onSelectShop: (id: string) => void;
  onCenterChange: (center: LatLng) => void;
  onLevelChange: (level: number) => void;
  onRegionChange: (region: string) => void;
  onAddressStatusChange: (status: string) => void;
  /** 지도 중심·반경 안의 실제 점포 조회 상태가 바뀔 때 */
  onNearbyShopsChange?: (state: NearbyShopsState) => void;
}

export function MapCanvas(props: MapCanvasProps) {
  const [loading, error] = useKakaoLoader({ appkey: props.appKey, libraries: ["services"] });
  const [timedOut, setTimedOut] = useState(false);
  const [hover, setHover] = useState<{ cell: string; pos: LatLng } | null>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const roadHitTest = useRef<((position: LatLng) => string | null) | null>(null);
  const handleHitTestChange = useCallback((hitTest: ((position: LatLng) => string | null) | null) => {
    roadHitTest.current = hitTest;
  }, []);
  const { onLevelChange } = props;
  const handleCreate = useCallback((created: kakao.maps.Map) => {
    // react-kakao-maps-sdk 1.2.2 reverses its minLevel/maxLevel setters.
    // Apply native bounds instead, preserving the constructor's initial level.
    created.setMinLevel(1);
    created.setMaxLevel(14);
    setMap(created);
    onLevelChange(created.getLevel());
  }, [onLevelChange]);
  useFootTrafficResize(map, props.center);
  const ready = !loading && !error;
  const { region, addressStatus, selectCenter, resolved } = useFootTrafficLocation(ready, props.center, props.address, props.onCenterChange);
  // 주소를 찾은 뒤(또는 찾지 못한 게 확정된 뒤)에만 점포를 조회한다. 그 전의 중심은 가게 위치가 아니다.
  const nearby = useNearbyShops(ready && resolved, props.center, props.radius);
  const { onNearbyShopsChange } = props;
  useEffect(() => { onNearbyShopsChange?.(nearby); }, [nearby, onNearbyShopsChange]);
  const { onRegionChange, onAddressStatusChange } = props;
  useEffect(() => { onRegionChange(region); }, [region, onRegionChange]);
  useEffect(() => { onAddressStatusChange(addressStatus); }, [addressStatus, onAddressStatusChange]);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setTimedOut(true), 15000);
    return () => window.clearTimeout(timer);
  }, [loading]);
  useEffect(() => { setHover(null); }, [props.lines]);

  if (error || (loading && timedOut)) return <MapAvailability state="error" />;
  if (loading || !resolved) return <MapAvailability state="loading" />;
  const hoverValue = hover ? props.cells.get(hover.cell) : undefined;

  return (
    <>
    <Map center={props.center} level={props.level} className="h-full w-full" keyboardShortcuts onCreate={handleCreate}
      onClick={(_, event) => {
        const pos = { lat: event.latLng.getLat(), lng: event.latLng.getLng() };
        const cell = roadHitTest.current?.(pos);
        if (cell) setHover({ cell, pos });
        else selectCenter(pos);
      }}
      onZoomChanged={(map) => props.onLevelChange(map.getLevel())}>
      <RoadPopulationLayer lines={props.lines} cuts={props.cuts} level={props.level} activeCell={hover?.cell ?? null} onHover={setHover} onHitTestChange={handleHitTestChange} />
      <Circle center={props.center} radius={props.radius} strokeWeight={1.5} strokeColor="#107e7d" strokeOpacity={0.7} strokeStyle="shortdash" fillColor="#107e7d" fillOpacity={0.035} zIndex={0} />
      <CustomOverlayMap position={props.center} zIndex={10}>
        <div aria-label="분석 중심 위치" className="h-3.5 w-3.5 rounded-full border-[3px] border-solid border-white bg-foundy-primary ring-4 ring-foundy-primary/20" />
      </CustomOverlayMap>
      <ShopMapMarkers shops={props.shops} selectedId={props.selectedShopId} onSelect={props.onSelectShop} />
      {hover && hoverValue && <CustomOverlayMap position={hover.pos} yAnchor={1.3} zIndex={15}>
        <PopulationTooltip value={hoverValue} level={hoverValue.observed ? toLevel(hoverValue.sum, props.cuts) : null} label={props.label} hour={props.hour} />
      </CustomOverlayMap>}
    </Map>
    <MapZoomControls level={props.level} onChange={props.onLevelChange} />
    </>
  );
}
