export interface NotificationCategoryBadgeProps {
  category: string;
}

export function NotificationCategoryBadge({ category }: NotificationCategoryBadgeProps) {
  const tone = category === "결정 필요"
    ? "bg-amber-50 text-amber-800"
    : category === "마감 임박"
      ? "bg-red-50 text-red-700"
      : "bg-foundy-primary/10 text-foundy-primary-ink";

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-medium leading-5 ${tone}`}>
      {category}
    </span>
  );
}
