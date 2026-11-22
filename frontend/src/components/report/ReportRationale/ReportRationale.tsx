export interface ReportRationaleProps {
  reason: string;
}

export function ReportRationale({ reason }: ReportRationaleProps) {
  if (!reason) return null;

  return (
    <dl className="m-0 max-w-prose">
      <dt className="text-sm font-semibold text-neutral-900">점검 이유</dt>
      <dd className="mx-0 mb-0 mt-1 break-keep text-[15px] leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">{reason}</dd>
    </dl>
  );
}
