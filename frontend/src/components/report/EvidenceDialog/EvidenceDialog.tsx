import { EvidenceItem } from "@/components/report/EvidenceItem";
import type { EvidenceItemData } from "@/types/report";

export type EvidenceDialogProps = {
  items: EvidenceItemData[];
  date?: string;
};

export function EvidenceDialog({ items }: EvidenceDialogProps) {
  return items.length ? (
    <section aria-label="참고 자료">
      {items.map((item, index) => (
        <EvidenceItem key={`${item.source}-${index}`} item={item} />
      ))}
    </section>
  ) : (
    <p className="m-0 py-4 text-center text-sm text-neutral-600">이 항목에 공개된 참고 자료가 아직 없어요.</p>
  );
}
