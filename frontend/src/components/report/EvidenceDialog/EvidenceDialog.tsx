import { EvidenceItem } from "@/components/report/EvidenceItem";
import { Element } from "@/components/view/Element";
import { type EvidenceItemData } from "@/types/report";

export type EvidenceDialogProps = {
  items: EvidenceItemData[];
  date: string;
};

export function EvidenceDialog({
  items,
  date,
}: EvidenceDialogProps) {
  return (
    <Element className="nx-stack">
      {items.length ? (
        items.map((item, index) => (
          <EvidenceItem
            key={`${item.source}-${index}`}
            item={item}
            date={date}
          />
        ))
      ) : (
        <Element className="nx-note">공개된 근거가 없어요.</Element>
      )}
    </Element>
  );
}
