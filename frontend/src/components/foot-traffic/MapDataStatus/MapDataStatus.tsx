export interface MapDataStatusProps { loading: boolean; error: string; addressStatus: string; retry: () => void }

export function MapDataStatus({ loading, error, addressStatus, retry }: MapDataStatusProps) {
  if (!loading && !error && !addressStatus) return null;
  return (
    <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-10 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-center text-sm text-neutral-600 lg:top-4 lg:max-w-[calc(100%-45rem)]">
      {error ? <span>{error} <button type="button" onClick={retry} className="border-0 bg-transparent p-0 text-sm font-semibold text-foundy-primary underline underline-offset-2">다시 시도</button></span>
        : <span>{addressStatus || "생활인구 데이터를 불러오고 있어요…"}</span>}
    </div>
  );
}
