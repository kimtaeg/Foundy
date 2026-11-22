"use client";

import { FootTrafficMapSkeleton } from "../FootTrafficMapSkeleton";

export interface MapAvailabilityProps {
  state: "loading" | "missing-key" | "error";
}

export function MapAvailability({ state }: MapAvailabilityProps) {
  if (state === "loading") {
    return <FootTrafficMapSkeleton canvasOnly />;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 p-6" role="status">
      <div className="max-w-72 rounded-2xl border border-solid border-neutral-200 bg-white p-6 text-center">
        <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50 text-foundy-primary" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></svg>
        </span>
        <h2 className="m-0 text-base font-bold text-neutral-800">지도를 불러오지 못했어요</h2>
        <p className="mb-0 mt-2 text-sm leading-relaxed text-neutral-600">{state === "missing-key" ? "지도 연결 설정을 확인해 주세요. 상권 정보와 데이터 기준은 계속 확인할 수 있어요." : "네트워크 또는 지도 서비스 연결을 확인한 뒤 다시 시도해 주세요."}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg border-0 bg-foundy-primary px-4 py-2 text-sm font-semibold text-white">다시 불러오기</button>
      </div>
    </div>
  );
}
