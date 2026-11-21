"use client";

import { useEffect, useRef, useState } from "react";
import { dedupeShops, placeToShop, SHOP_GROUPS, SHOP_PAGE_LIMIT } from "@/lib/market";
import type { LatLng } from "@/types/foot-traffic";
import type { NearbyShopsState, Shop } from "@/types/market";

const IDLE: NearbyShopsState = { status: "idle", shops: [], truncated: false };

/** 한 그룹(카페·음식점)을 가까운 순으로 최대 3쪽까지 받는다. */
function searchGroup(places: kakao.maps.services.Places, code: "CE7" | "FD6", center: LatLng, radius: number) {
  return new Promise<{ shops: Shop[]; truncated: boolean }>((resolve, reject) => {
    const shops: Shop[] = [];
    const page = (number: number) =>
      places.categorySearch(
        code,
        (result, status, pagination) => {
          if (status === kakao.maps.services.Status.ZERO_RESULT) return resolve({ shops, truncated: false });
          if (status !== kakao.maps.services.Status.OK) return reject(new Error(`카카오 장소 검색 실패 (${status})`));
          for (const place of result) {
            const shop = placeToShop(place);
            if (shop) shops.push(shop);
          }
          if (pagination.hasNextPage && number < SHOP_PAGE_LIMIT) return page(number + 1);
          resolve({ shops, truncated: pagination.hasNextPage });
        },
        {
          location: new kakao.maps.LatLng(center.lat, center.lng),
          radius,
          sort: kakao.maps.services.SortBy.DISTANCE,
          size: 15,
          page: number,
        },
      );
    page(1);
  });
}

/**
 * 분석 중심·반경 안의 실제 카페·음식점을 카카오 지도에서 조회한다 (카테고리 검색 CE7·FD6, 가까운 순).
 * 중심이나 반경이 바뀌면 잠깐 기다렸다가 다시 조회하고, 같은 조건은 다시 받지 않는다.
 * enabled 가 아니면(지도 SDK 준비 전·주소 찾는 중) 조회하지 않는다.
 */
export function useNearbyShops(enabled: boolean, center: LatLng, radius: number): NearbyShopsState {
  const [state, setState] = useState<NearbyShopsState>(IDLE);
  const cache = useRef(new Map<string, NearbyShopsState>());
  const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${radius}`;

  useEffect(() => {
    if (!enabled) return;
    const cached = cache.current.get(key);
    if (cached) {
      setState(cached);
      return;
    }
    let current = true;
    setState((previous) => ({ ...previous, status: "loading" }));
    const timer = window.setTimeout(() => {
      const places = new kakao.maps.services.Places();
      Promise.all(SHOP_GROUPS.map((group) => searchGroup(places, group.code, center, radius)))
        .then((groups) => {
          if (!current) return;
          const next: NearbyShopsState = {
            status: "ready",
            shops: dedupeShops(groups.flatMap((group) => group.shops)),
            truncated: groups.some((group) => group.truncated),
          };
          if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value as string);
          cache.current.set(key, next);
          setState(next);
        })
        .catch(() => {
          if (current) setState({ status: "error", shops: [], truncated: false });
        });
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
    // center·radius 는 key 로 묶어서 본다 (같은 값으로 새 객체가 와도 다시 조회하지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return state;
}
