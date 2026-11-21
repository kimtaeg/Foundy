export const fmtYmd = (ymd: string) => /^\d{8}$/.test(ymd)
  ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}` : ymd;
export const fmtInt = (value: number) => Math.round(value).toLocaleString("ko-KR");
