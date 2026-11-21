export const won = (value: unknown) =>
  `${new Intl.NumberFormat("ko-KR").format(Number(value) || 0)}원`;
