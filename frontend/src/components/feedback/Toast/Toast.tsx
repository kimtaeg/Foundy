export type ToastProps = { message: string };

export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      className="fixed right-4 bottom-6 z-[100] max-w-[calc(100vw-32px)] rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg sm:right-7"
    >
      {message}
    </div>
  );
}
