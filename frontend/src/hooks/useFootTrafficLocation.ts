"use client";

import { useEffect, useRef, useState } from "react";
import { addressCandidates } from "@/lib/market";
import type { LatLng } from "@/types/foot-traffic";

const toPoint = (x: string, y: string): LatLng | null => {
  const point = { lat: Number(y), lng: Number(x) };
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) ? point : null;
};

function searchAddress(geocoder: kakao.maps.services.Geocoder, query: string): Promise<LatLng | null> {
  return new Promise((resolve) =>
    geocoder.addressSearch(query, (result, status) =>
      resolve(status === kakao.maps.services.Status.OK && result[0] ? toPoint(result[0].x, result[0].y) : null),
    ),
  );
}

function searchKeyword(places: kakao.maps.services.Places, query: string): Promise<LatLng | null> {
  return new Promise((resolve) =>
    places.keywordSearch(query, (result, status) =>
      resolve(status === kakao.maps.services.Status.OK && result[0] ? toPoint(result[0].x, result[0].y) : null),
    ),
  );
}

/** 입력한 주소를 좌표로 바꾼다. 주소 검색 → 건물명·장소 검색 순으로, 원문 → 층·호를 뗀 주소 → 도로명 순으로 시도한다. */
async function locate(address: string): Promise<{ point: LatLng; approximate: boolean } | null> {
  const geocoder = new kakao.maps.services.Geocoder();
  const places = new kakao.maps.services.Places();
  for (const { query, approximate } of addressCandidates(address)) {
    const point = (await searchAddress(geocoder, query)) ?? (await searchKeyword(places, query));
    if (point) return { point, approximate };
  }
  return null;
}

/**
 * 가게 주소를 찾아 분석 중심으로 삼고, 사용자가 따로 고른 분석 위치의 행정구역 이름을 붙인다.
 * resolved 는 주소 찾기가 끝났는지 (주소가 없으면 바로 true) — 끝나기 전에는 지도를 그리지 않아 엉뚱한 곳에서 시작하지 않는다.
 */
export function useFootTrafficLocation(
  ready: boolean,
  center: LatLng,
  address: string | undefined,
  onCenterChange: (point: LatLng) => void,
) {
  const [region, setRegion] = useState("");
  const [addressStatus, setAddressStatus] = useState("");
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const changeRef = useRef(onCenterChange);
  const request = useRef(0);
  useEffect(() => { changeRef.current = onCenterChange; }, [onCenterChange]);

  const wanted = address?.trim() ?? "";
  useEffect(() => {
    if (!ready || !wanted) return;
    let current = true;
    const version = ++request.current;
    setAddressStatus("가게 주소를 찾고 있어요.");
    void locate(wanted).then((found) => {
      if (!current || request.current !== version) return;
      if (!found) {
        setAddressStatus("가게 주소를 찾지 못했어요. 지도에서 분석 위치를 선택해 주세요.");
      } else {
        setAddressStatus(found.approximate ? "정확한 번지를 찾지 못해 도로 부근에서 시작했어요. 필요하면 지도에서 위치를 다시 골라 주세요." : "");
        changeRef.current(found.point);
      }
      setResolvedFor(wanted);
    });
    return () => { current = false; };
  }, [ready, wanted]);

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
    setAddressStatus("");
    changeRef.current(point);
  };
  const resolved = !wanted || resolvedFor === wanted;
  return { region, addressStatus, selectCenter, resolved };
}
