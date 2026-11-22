import { FRANCHISE } from "@/data/market";
import type {
  ChartRow,
  MarketAnalysis,
  MarketCategory,
  MarketPoint,
  Shop,
} from "@/types/market";

/** Great-circle distance from the selected map centre, independent of fixture distances. */
export function distanceMeters(from: MarketPoint, to: MarketPoint): number {
  const radians = Math.PI / 180;
  const latitude = (to.lat - from.lat) * radians;
  const longitude = (to.lng - from.lng) * radians;
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(from.lat * radians) *
      Math.cos(to.lat * radians) *
      Math.sin(longitude / 2) ** 2;
  return (
    6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  );
}

/** These figures describe the supplied sample, never a census of all local businesses. */
export function analyzeMarket(
  shops: Shop[],
  center: MarketPoint,
  radius: number,
  category: MarketCategory,
): MarketAnalysis {
  const nearby = shops
    .map((shop) => ({ ...shop, dist: distanceMeters(center, shop) }))
    .filter(
      (shop) =>
        shop.dist <= radius && (category === "all" || shop.cat === category),
    )
    .sort((a, b) => a.dist - b.dist);
  const count = nearby.length;
  const franchises = nearby.filter((shop) => FRANCHISE.test(shop.name));
  const dessert = nearby.filter((shop) =>
    /디저트|베이커리|빵|브레드/.test(shop.sub + shop.name),
  );
  const groups = new Map<string, number>();
  for (const shop of nearby)
    groups.set(shop.sub, (groups.get(shop.sub) ?? 0) + 1);
  const composition: ChartRow[] = [...groups]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      percent: count ? (value / count) * 100 : 0,
    }));
  const distanceRows = [0.25, 0.5, 1].map((fraction) => {
    const boundary = Math.round(radius * fraction);
    const value = nearby.filter((shop) => shop.dist <= boundary).length;
    return {
      label: `${boundary.toLocaleString("ko-KR")}m 안`,
      value,
      percent: count ? (value / count) * 100 : 0,
    };
  });
  return {
    nearby,
    count,
    density: count
      ? Math.round(count / (Math.PI * (radius / 1000) ** 2))
      : null,
    franchiseCount: franchises.length,
    franchisePercent: count
      ? Math.round((franchises.length / count) * 100)
      : null,
    independentCount: count - franchises.length,
    dessertCount: dessert.length,
    composition,
    distanceRows,
  };
}
