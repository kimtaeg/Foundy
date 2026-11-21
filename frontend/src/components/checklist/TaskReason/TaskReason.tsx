import { Element } from "@/components/view/Element";
import type { ChecklistTask } from "@/types/checklist";

export interface TaskReasonProps {
  task: ChecklistTask;
}

const monthDay = (date: string) => date.slice(5).replace("-", ".");

/** 왜 해야 하는지, 근거 법령, 법정 기한, 다시 확인 안내. 서버 연결 모드에서 값이 있을 때만 그린다. */
export function TaskReason({ task }: TaskReasonProps) {
  const { reason, lawBasis, statutory, review } = task;
  if (!reason && !lawBasis && !statutory && !review) return null;
  return (
    <Element className="nx-muted" style={{ marginTop: 4 }}>
      {reason && <div>왜 필요한가요: {reason}</div>}
      {lawBasis && (
        <div>
          근거:{" "}
          {lawBasis.url ? (
            <Element as="a" href={lawBasis.url} target="_blank" rel="noopener noreferrer">
              {lawBasis.label} ↗
            </Element>
          ) : (
            lawBasis.label
          )}
        </div>
      )}
      {statutory && (
        <div>
          <b>법정 기한 {monthDay(statutory.date)}까지</b> · {statutory.basis}. 아래 날짜는 서비스가 권하는 준비일이에요.
        </div>
      )}
      {review && (
        <Element className="nx-note" style={{ marginTop: 6 }}>
          {review}{" "}
          <Element as="button" className="nx-btn outline slim" data-nx="taskack" data-tid={task.id}>
            확인했어요
          </Element>
        </Element>
      )}
    </Element>
  );
}
