export interface ChatWelcomeProps {
  storeName: string;
  undecided: boolean;
}

export function ChatWelcome({
  storeName,
  undecided,
}: ChatWelcomeProps) {
  return (
    <div className="py-3">
      <h2 className="mb-2 mt-0 text-lg font-semibold leading-7 tracking-tight text-neutral-900 [overflow-wrap:anywhere]">
        {storeName},<br />무엇을 도와드릴까요?
      </h2>
      <p className="m-0 text-sm leading-6 text-neutral-600">
        {undecided
          ? "상권 비교부터 오늘 할 일까지, 가게 준비를 함께 정리해요."
          : "가게의 점검 결과를 바탕으로 오늘 할 일과 다음 단계를 함께 정리해요."}
      </p>
    </div>
  );
}
