import type { MarketPoint } from "@/types/market";

/** 가게 좌표를 모를 때의 기본 지도 중심(서울시청). 특정 상권을 가리키지 않는다. */
export const MARKET_DEFAULT_CENTER: MarketPoint = {
  lat: 37.5665,
  lng: 126.978,
};

export const FRANCHISE =
  /빽다방|이디야|메가MGC|스타벅스|투썸|컴포즈|할리스|폴바셋/;

export const density = (n: number) => Math.round(n / (Math.PI * 0.3 * 0.3));

export const compLevel = (d: number) =>
  d < 120 ? "낮음" : d < 200 ? "보통" : "높음";
