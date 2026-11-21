import { MarketPanelCard } from "@/components/sites/MarketPanelCard";

const questions = [
  "평일·주말의 낮과 저녁에 실제 보행량을 비교하기",
  "가까운 경쟁 가게 3곳의 메뉴·가격·영업 시간 확인하기",
  "전 임차인의 폐업 이유와 실제 임대 조건 확인하기",
  "간판이 보이는 방향, 출입구와 보행 동선 살펴보기",
];
export interface FieldChecklistCardProps {
  onOpenReport?: () => void;
}

export function FieldChecklistCard({
  onOpenReport,
}: FieldChecklistCardProps) {
  return (
    <MarketPanelCard
      title="현장에서 확인할 것"
      description="생활인구와 예시 점포 자료만으로 알 수 없는 내용을 확인하세요."
    >
      <ol className="m-0 list-none space-y-3 p-0">
        {questions.map((question, index) => (
          <li
            key={question}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-600"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-foundy-primary-ink">
              {index + 1}
            </span>
            <span>{question}</span>
          </li>
        ))}
      </ol>
      {onOpenReport && <button
        type="button"
        onClick={onOpenReport}
        className="mt-4 min-h-10 w-full rounded-xl border-0 bg-foundy-primary px-3 text-sm font-semibold text-white hover:bg-foundy-primary/90"
      >
        창업 점검 리포트 보기 →
      </button>}
    </MarketPanelCard>
  );
}
