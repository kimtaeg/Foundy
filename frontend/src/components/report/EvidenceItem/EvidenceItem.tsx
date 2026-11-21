import { Element } from "@/components/view/Element";
import { type EvidenceItemData } from "@/types/report";

export type EvidenceItemProps = {
  item: EvidenceItemData;
  date: string;
};

export function EvidenceItem({
  item,
  date,
}: EvidenceItemProps) {
  return (
    <Element className="nx-note">
      <b>{item.source}</b>
      <p>{item.value || ""}</p>
      <Element className="nx-chips">
        <span>종류 {item.kind === "law" ? "법령 조문" : "조회 데이터"}</span>
        <span>조회일자 {date}</span>
        {item.mock !== false && <span>모의 응답 (원문 미조회)</span>}
      </Element>
      {item.url && (
        <Element
          as="a"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foundy-primary font-bold"
        >
          원문·공식 사이트 ↗
        </Element>
      )}
    </Element>
  );
}
