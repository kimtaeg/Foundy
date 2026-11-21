import { Element } from "@/components/view/Element";
import type { TaskKind } from "@/types/checklist";

export interface ChecklistProgressProps {
  opening: string;
  done: number;
  total: number;
  /** 필수·조건부·권장 개수 (서버 연결 모드에서만) */
  kinds?: Record<TaskKind, number> | null;
  /** 법령 개정 등으로 다시 확인해야 하는 작업 수 */
  reviewCount?: number;
}
export function ChecklistProgress({ opening, done, total, kinds, reviewCount = 0 }: ChecklistProgressProps) {
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
        {kinds && (
          <Element className="nx-badges" style={{ marginTop: 10 }}>
            <Element as="span" className="nx-badge high">필수 {kinds.legal_obligation}개</Element>
            <Element as="span" className="nx-badge low">조건부 {kinds.conditional}개</Element>
            <Element as="span" className="nx-badge">권장 {kinds.preparation}개</Element>
          </Element>
        )}
        {reviewCount > 0 && (
          <Element className="nx-tag" style={{ marginTop: 8 }}>
            법령 개정 등으로 다시 확인할 작업이 {reviewCount}개 있어요
          </Element>
        )}
      </div>
    </Element>
  );
}
