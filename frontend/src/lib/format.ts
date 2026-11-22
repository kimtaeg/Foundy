export const won = (value: unknown) =>
  `${new Intl.NumberFormat("ko-KR").format(Number(value) || 0)}원`;

/** 만원 단위 금액 표시 (예: 270 → "270만 원", 22.3 → "22.3만 원") */
export const manwonText = (value: number) =>
  `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value)}만 원`;
