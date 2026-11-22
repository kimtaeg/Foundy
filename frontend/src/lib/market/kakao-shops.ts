import type { NearbyShopsSource, Shop } from "@/types/market";

const PAGE_LIMIT = 3;

function toShop(place: kakao.maps.services.PlacesSearchResultItem): Shop | null {
  const lat = Number(place.y);
  const lng = Number(place.x);
  if (!place.y?.trim() || !place.x?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const categories = place.category_name.split(">").map((name) => name.trim());
  const isCafe = place.category_group_code === "CE7" || categories.includes("카페");
  const category = isCafe ? "카페" : "음식점";
  return {
    id: `kakao-${place.id}`,
    name: place.place_name,
    lat,
    lng,
    dist: Number(place.distance) || 0,
    sub: categories.at(-1) || category,
    cat: category,
    ex: false,
  };
}

async function searchGroup(places: kakao.maps.services.Places, code: "CE7" | "FD6", location: kakao.maps.LatLng, radius: number) {
  const shops: Shop[] = [];
  let fetched = 0;
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const batch = await new Promise<{ shops: Shop[]; hasNextPage: boolean; size: number; total: number }>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("카카오 장소 검색 시간 초과")), 8000);
      places.categorySearch(code, (results, status, pagination) => {
        window.clearTimeout(timer);
        if (status === kakao.maps.services.Status.ZERO_RESULT) {
          resolve({ shops: [], hasNextPage: false, size: 0, total: 0 });
        } else if (status === kakao.maps.services.Status.OK) {
          resolve({
            shops: results.map(toShop).filter((shop) => shop !== null),
            hasNextPage: pagination.hasNextPage,
            size: results.length,
            total: pagination.totalCount,
          });
        } else {
          reject(new Error("카카오 장소 검색 실패"));
        }
      }, { location, radius, sort: kakao.maps.services.SortBy.DISTANCE, size: 15, page });
    });
    shops.push(...batch.shops);
    fetched += batch.size;
    if (!batch.hasNextPage) return { shops, truncated: batch.total > fetched };
  }
  return { shops, truncated: true };
}

/** Search both groups so the category tabs can reuse the same results. */
export const loadKakaoNearbyShops: NearbyShopsSource = async ({ lat, lng }, radius) => {
  const places = new kakao.maps.services.Places();
  const location = new kakao.maps.LatLng(lat, lng);
  const [cafes, restaurants] = await Promise.all([
    searchGroup(places, "CE7", location, radius),
    searchGroup(places, "FD6", location, radius),
  ]);
  const shops = new Map(restaurants.shops.map((shop) => [shop.id, shop]));
  for (const shop of cafes.shops) shops.set(shop.id, shop);
  return { shops: [...shops.values()], truncated: cafes.truncated || restaurants.truncated };
};
