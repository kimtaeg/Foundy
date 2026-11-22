export const pad = (value: number | string) => String(value).padStart(2, "0");
export const D = (value: string) => new Date(`${value}T12:00:00`);
export const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
export const diffDays = (left: Date, right: Date) =>
  Math.round((left.getTime() - right.getTime()) / 86400000);
export const realToday = () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
};
export const dday = (value: string) => {
  const days = diffDays(D(value), realToday());
  return days >= 0 ? `D-${days}` : `D+${Math.abs(days)}`;
};
