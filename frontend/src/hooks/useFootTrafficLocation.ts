"use client";

import { useEffect, useRef, useState } from "react";
import type { NearbyShopsAvailability } from "@/types/market";
import type { LatLng } from "@/types/foot-traffic";

/** Resolve store address once, and label the user's independently selected analysis point. */
export function useFootTrafficLocation(
  ready: boolean,
  center: LatLng,
  address: string | undefined,
  onCenterChange: (point: LatLng) => void,
) {
  const [region, setRegion] = useState("");
  const [addressStatus, setAddressStatus] = useState("");
  const [addressLookup, setAddressLookup] = useState<{ address: string; status: "ready" | "location" }>();
  const locationAvailability: NearbyShopsAvailability = !address?.trim() ? "ready" : addressLookup?.address === address ? addressLookup.status : "loading";
  const changeRef = useRef(onCenterChange);
  const request = useRef(0);
  useEffect(() => { changeRef.current = onCenterChange; }, [onCenterChange]);

  useEffect(() => {
    if (!ready || !address?.trim()) return;
    let current = true;
    const version = ++request.current;
    setAddressStatus("가게 주소를 찾고 있어요.");
    const finish = (message: string, point?: LatLng) => {
      if (!current || request.current !== version) return;
      current = false;
      window.clearTimeout(timer);
      setAddressLookup({ address, status: point ? "ready" : "location" });
      setAddressStatus(message);
      if (point) changeRef.current(point);
    };
    const timer = window.setTimeout(() => finish("주소 검색이 지연되고 있어요. 지도에서 분석 위치를 선택해 주세요."), 8000);
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      if (status !== kakao.maps.services.Status.OK || !result[0]) {
        finish("가게 주소를 찾지 못했어요. 지도에서 분석 위치를 선택해 주세요.");
        return;
      }
      const point = { lat: Number(result[0].y), lng: Number(result[0].x) };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
        finish("주소 좌표를 확인할 수 없어요. 지도에서 위치를 선택해 주세요.");
        return;
      }
      finish("", point);
    });
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [ready, address]);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    setRegion("");
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(center.lng, center.lat, (result, status) => {
      if (!current) return;
      setRegion(status === kakao.maps.services.Status.OK
        ? result.find((entry) => entry.region_type === "H")?.address_name ?? result[0]?.address_name ?? ""
        : "");
    });
    return () => { current = false; };
  }, [ready, center.lat, center.lng]);

  const selectCenter = (point: LatLng) => {
    request.current++;
    if (address) setAddressLookup({ address, status: "ready" });
    setAddressStatus("");
    changeRef.current(point);
  };
  return { region, addressStatus, locationAvailability, selectCenter };
}
