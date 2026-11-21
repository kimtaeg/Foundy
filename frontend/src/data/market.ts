import type { MarketPoint, PriceRange, Shop } from "@/types/market";

/** Illustrative coordinates, not a live Kakao Places response. */
export const MARKET_DEMO_CENTER: MarketPoint = {
  lat: 37.54515,
  lng: 127.05713,
};

/** Demonstration market data and display-independent market calculations. */
const shopFixtures: [string, number, number, number, string][] = [
  ["빽다방 성수역점", 0, 127.05713, 37.54515, "빽다방"],
  ["스왈로우라운지커피", 43, 127.05698, 37.54552, "카페"],
  ["이디야커피 성수아카데미점", 49, 127.05769, 37.54517, "이디야커피"],
  ["메가MGC커피 성수역점", 64, 127.05701, 37.54458, "메가MGC커피"],
  ["뚜흐느솔", 102, 127.0574, 37.54605, "테마카페"],
  ["브레드05 성수점", 103, 127.05821, 37.54478, "커피전문점"],
  ["어니언 성수", 104, 127.0582, 37.54476, "카페"],
  ["북눅 성수", 121, 127.05776, 37.54612, "북카페"],
  ["라망 성수직영점", 127, 127.05736, 37.54628, "디저트카페"],
  ["벌툰 성수점", 144, 127.05748, 37.54387, "벌툰"],
  ["스타벅스 성수점", 165, 127.05548, 37.54445, "스타벅스"],
  ["에낭 성수점", 171, 127.05519, 37.54514, "디저트카페"],
  ["맥파이앤타이거 성수티룸", 173, 127.05658, 37.54365, "카페"],
  ["커피익스플로러", 180, 127.05622, 37.5466, "커피전문점"],
  ["카스타니아", 180, 127.05622, 37.54661, "카페"],
];

export const SHOPS: Shop[] = shopFixtures.map((a, i) => ({
  id: "k" + i,
  name: a[0],
  dist: a[1],
  lng: a[2],
  lat: a[3],
  sub: a[4],
  cat: "카페",
  ex: true,
}));

const foodFixtures: [string, number, string][] = [
  ["예시 한식당 1", 90, "한식"],
  ["예시 한식당 2", 140, "한식"],
  ["예시 일식당", 170, "일식"],
  ["예시 양식당", 210, "양식"],
  ["예시 분식집", 120, "분식"],
  ["예시 고깃집", 250, "한식"],
  ["예시 중식당", 190, "중식"],
  ["예시 파스타집", 280, "양식"],
];

export const EXFOOD: Shop[] = foodFixtures.map((a, i) => {
  const ang = ((i * 47 + 20) * Math.PI) / 180;
  return {
    id: "f" + i,
    name: a[0],
    dist: a[1],
    lng: 127.05713 + (a[1] * Math.cos(ang)) / 88000,
    lat: 37.54515 + (a[1] * Math.sin(ang)) / 110540,
    sub: a[2],
    cat: "음식점",
    ex: true,
  };
});

export const AREAS = [
  {
    id: "a1",
    name: "성수2가3동 (성수역 일대)",
    count: 54,
    note: "성수역 일대 후보지 비교용 예시 지표",
    real: false,
    traits: "유동 많고 프랜차이즈·디저트 카페가 섞여 있어요",
  },
  {
    id: "a2",
    name: "성수1가1동 (서울숲 인근)",
    count: 31,
    note: "예시 지표",
    real: false,
    traits: "산책 수요 중심, 개인 카페 비중이 높아요",
  },
  {
    id: "a3",
    name: "송정동 (뚝섬 방향)",
    count: 12,
    note: "예시 지표",
    real: false,
    traits: "경쟁 가게가 적지만 유동 인구는 확인이 필요해요",
  },
];

export const FRANCHISE =
  /빽다방|이디야|메가MGC|스타벅스|투썸|컴포즈|할리스|폴바셋/;

export const PRICE_EX: PriceRange = { min: 2000, median: 4500, max: 6500 };

export const density = (n: number) => Math.round(n / (Math.PI * 0.3 * 0.3));

export const compLevel = (d: number) =>
  d < 120 ? "낮음" : d < 200 ? "보통" : "높음";
