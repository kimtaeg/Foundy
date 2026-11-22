/** 임대료 비교의 기준 위치 (#199). 지도 중심이 처음 위치(가게 주소)와 다르면 그 좌표로 다시 계산한다. */
import type { ApiRent, ApiRentQuery } from "@/lib/api/types";
import type { MarketPoint } from "@/types/market";

/** 지도를 움직이는 동안 매번 부르지 않도록 멈춘 뒤 이만큼 기다렸다가 요청한다 */
export const RENT_LOCATION_DELAY_MS = 600;
const SAME_POINT = 1e-6;

export function samePoint(a: MarketPoint, b: MarketPoint): boolean {
  return Math.abs(a.lat - b.lat) < SAME_POINT && Math.abs(a.lng - b.lng) < SAME_POINT;
}

/** 지도 중심이 처음 위치와 같거나 모르면 가게 주소 기준(빈 값), 다르면 지도 중심 좌표 */
export function rentLocationQuery(center?: MarketPoint, origin?: MarketPoint): Pick<ApiRentQuery, "lat" | "lng"> {
  if (!center || !origin || samePoint(center, origin)) return {};
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return { lat: round(center.lat), lng: round(center.lng) };
}

/** 같은 위치인지 비교하는 키 (빈 값이면 가게 주소 기준) */
export function rentLocationKey(query: Pick<ApiRentQuery, "lat" | "lng">): string {
  return query.lat === undefined || query.lng === undefined ? "store" : `${query.lat},${query.lng}`;
}

/** 카드 위에 보여 줄 기준 위치 문구. 옛 응답(location 없음)·확인 실패면 null */
export function rentLocationLabel(result?: ApiRent | null): string | null {
  const location = result?.location;
  if (!location) return null;
  if (location.source === "store") return "가게 주소 기준";
  if (!location.resolved || !location.region) return null;
  const dong = location.region.trim().split(/\s+/).pop();
  return dong ? `지도 중심(${dong}) 기준` : "지도 중심 기준";
}

/** 지도 중심 기준으로 동을 확인하지 못했을 때 숫자 대신 보여 줄 이유 */
export function rentLocationProblem(result?: ApiRent | null): string | null {
  const location = result?.location;
  if (result?.status !== "unavailable" || location?.source !== "map") return null;
  return result.reason ?? null;
}

export type RentInputs = Pick<ApiRentQuery, "monthly_rent" | "deposit" | "area">;
type RentLocation = Pick<ApiRentQuery, "lat" | "lng">;

export interface RentRequesterOptions {
  source: (query: ApiRentQuery) => Promise<ApiRent>;
  /** 처음 위치 (빈 값이면 가게 주소 기준) */
  location?: RentLocation;
  delay?: number;
  onStart(): void;
  onResult(result: ApiRent): void;
  onError(): void;
  /** 마지막 요청이 끝났을 때만 부른다 */
  onSettled(): void;
}

/**
 * 임대료 비교 요청을 관리한다 (#199).
 * - 지도 위치가 바뀌면 delay 뒤에 한 번만 부른다 (움직이는 동안 매번 부르지 않는다)
 * - 마지막으로 제출한 월세·보증금·면적을 유지한 채 새 위치로 부른다
 * - 늦게 온 이전 응답은 버린다 (마지막 요청의 응답만 반영)
 */
export function createRentRequester(options: RentRequesterOptions) {
  const delay = options.delay ?? RENT_LOCATION_DELAY_MS;
  let inputs: RentInputs = {};
  let location: RentLocation = options.location ?? {};
  let locationKey = rentLocationKey(location);
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const send = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const id = ++latest;
    options.onStart();
    return options.source({ ...inputs, ...location }).then(
      (result) => { if (id === latest) options.onResult(result); },
      () => { if (id === latest) options.onError(); },
    ).finally(() => { if (id === latest) options.onSettled(); });
  };

  return {
    /** 처음 불러오기 (지금 위치 기준) */
    load: () => send(),
    /** 입력을 제출한다. 기다리던 위치 변경 요청이 있으면 이 요청에 합친다 */
    submit: (next: RentInputs) => { inputs = next; return send(); },
    /** 지도 위치가 바뀌었다. 위치가 같으면 아무것도 하지 않는다 */
    moveTo: (next: RentLocation) => {
      const key = rentLocationKey(next);
      if (key === locationKey) return;
      location = next;
      locationKey = key;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { void send(); }, delay);
    },
    /** 화면을 떠날 때. 기다리던 요청을 취소하고 받아 둔 응답을 반영하지 않는다 */
    dispose: () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      latest += 1;
    },
  };
}
