import { Element } from "@/components/view/Element";

export interface ChecklistProgressProps {
  opening: string;
  done: number;
  total: number;
}
export function ChecklistProgress({ opening, done, total }: ChecklistProgressProps) {
  return (
    <Element className="nx-banner">
      <div>
        <Element className="nx-kicker">개업 예정 {opening}</Element>
        <h3 style={{ margin: "7px 0" }}>
          {done} / {total}개 완료
        </h3>
        <Element className="nx-prog">
          <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </Element>
      </div>
    </Element>
  );
}
