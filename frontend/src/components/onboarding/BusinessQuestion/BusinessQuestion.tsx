export interface BusinessQuestionProps {
  field: string;
  title: string;
  description: string;
  value: boolean | null;
}

export function BusinessQuestion({ field, title, description, value }: BusinessQuestionProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-0 border-b border-solid border-neutral-200 py-4 first:border-t">
      <div className="min-w-0 flex-1 basis-52">
        <p id={`question-${field}`} className="m-0 text-base font-semibold leading-6 text-neutral-900">{title}</p>
        <p className="mb-0 mt-0.5 text-sm leading-5 text-neutral-600">{description}</p>
      </div>
      <div role="group" aria-labelledby={`question-${field}`} className="inline-grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
        {[true, false].map(answer => (
          <button
            key={String(answer)}
            type="button"
            aria-pressed={value === answer}
            data-nx="yn"
            data-k={field}
            data-v={answer ? "1" : "0"}
            className={`min-h-11 min-w-14 rounded-md border-0 px-2 text-sm font-medium leading-5 transition-colors focus-visible:outline-foundy-primary motion-reduce:transition-none ${
              value === answer ? answer ? "bg-foundy-primary text-white" : "bg-white text-neutral-900"
                : "bg-transparent text-neutral-600 hover:bg-white hover:text-neutral-900"
            }`}
          >
            {answer ? "네" : "아니요"}
          </button>
        ))}
      </div>
    </div>
  );
}
