import type { Shop } from "@/types/market";

/** 카카오 장소 검색 결과에서 점포에 필요한 값만 (SDK 타입에 기대지 않아 서버·테스트에서도 쓴다). */
export interface PlaceLike {
  id: string;
  place_name: string;
  category_name: string;
  x: string;
  y: string;
  place_url?: string;
  distance?: string;
}

/** 조회하는 카테고리 그룹: CE7 카페, FD6 음식점. 한 번에 최대 3쪽(45곳)까지 받을 수 있다. */
export const SHOP_GROUPS = [
  { code: "CE7", label: "카페" },
  { code: "FD6", label: "음식점" },
] as const;
export const SHOP_PAGE_LIMIT = 3;

/** 카카오 카테고리 이름(예: "음식점 > 카페 > 커피전문점")의 마지막 분류. */
export function subCategory(categoryName: string): string {
  const parts = categoryName.split(">").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? categoryName;
}

/** 카카오 장소를 화면의 점포로 바꾼다. 좌표가 없으면 null. 음식점 그룹에도 카페가 섞여 있어 이름으로 다시 나눈다. */
export function placeToShop(place: PlaceLike): Shop | null {
  const lng = Number(place.x);
  const lat = Number(place.y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const distance = Number(place.distance);
  return {
    id: `kakao-${place.id}`,
    name: place.place_name,
    dist: Number.isFinite(distance) ? distance : 0,
    lng,
    lat,
    sub: subCategory(place.category_name),
    cat: place.category_name.includes("카페") ? "카페" : "음식점",
    ex: false,
    url: place.place_url || undefined,
  };
}

/** 같은 장소가 두 그룹에서 오면 한 번만 둔다 (먼저 온 것을 쓴다). */
export function dedupeShops(shops: Shop[]): Shop[] {
  const seen = new Set<string>();
  return shops.filter((shop) => (seen.has(shop.id) ? false : (seen.add(shop.id), true)));
}
