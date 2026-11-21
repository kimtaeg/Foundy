export interface QuestionSuggestionsProps {
  questions: string[];
  busy?: boolean;
}

export function QuestionSuggestions({
  questions,
  busy = false,
}: QuestionSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="이어서 물어보기">
      {questions.map((question) => (
        <button
          type="button"
          key={question}
          className="max-w-full rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-left text-sm leading-5 text-neutral-700 transition-colors [overflow-wrap:anywhere] hover:border-foundy-primary hover:bg-neutral-50 hover:text-foundy-primary-ink disabled:cursor-not-allowed disabled:text-neutral-500"
          data-nx="cask"
          data-q={question}
          disabled={busy}
        >
          {question}
        </button>
      ))}
    </div>
  );
}
