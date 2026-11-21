export interface FavoriteQuestion {
  query: string;
  label: string;
}

export interface FavoriteQuestionsProps {
  /** 추천 질문은 호출하는 쪽(서버 추천 질문 API)이 준다. 없으면 표시하지 않는다. */
  questions?: FavoriteQuestion[];
  busy?: boolean;
}

export function FavoriteQuestions({ questions = [], busy = false }: FavoriteQuestionsProps) {
  if (!questions.length) return null;
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
