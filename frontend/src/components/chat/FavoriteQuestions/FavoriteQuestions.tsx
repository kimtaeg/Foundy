const questions = [
  { query: "오늘 뭐부터 하죠?", label: "오늘 할 일 정리" },
  { query: "구청에 전화하기 전에 뭘 준비하죠?", label: "구청 통화 준비" },
  { query: "개업일을 4월 1일로 미루고 싶어요", label: "개업일 변경" },
];

export interface FavoriteQuestionsProps { busy?: boolean }

export function FavoriteQuestions({ busy = false }: FavoriteQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="추천 질문">
      {questions.map((question) => (
        <button
          type="button"
          key={question.query}
          className="rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-left text-sm leading-5 text-neutral-700 transition-colors hover:border-foundy-primary hover:bg-neutral-50 hover:text-foundy-primary-ink disabled:cursor-not-allowed disabled:text-neutral-500"
          data-nx="cask"
          data-q={question.query}
          disabled={busy}
        >
          {question.label}
        </button>
      ))}
    </div>
  );
}
