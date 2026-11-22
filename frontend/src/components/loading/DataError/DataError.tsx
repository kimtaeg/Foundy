export interface DataErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function DataError({ message = "내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", onRetry }: DataErrorProps) {
  return (
    <div role="alert" className="rounded-2xl border border-solid border-neutral-200 bg-white p-5 text-sm leading-6 text-neutral-700">
      <p className="m-0">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 min-h-10 rounded-xl border-0 bg-foundy-primary px-4 py-2 text-sm font-medium text-white hover:bg-foundy-primary-ink">
          다시 시도
        </button>
      )}
    </div>
  );
}
