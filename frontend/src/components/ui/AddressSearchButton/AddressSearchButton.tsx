"use client";

import { useId, useRef, useState } from "react";
import { loadKakaoPostcode } from "@/lib/kakao-postcode";

export interface AddressSearchButtonProps {
  onSelect: (address: string) => void;
}

export function AddressSearchButton({ onSelect }: AddressSearchButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const title = useId();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  async function showSearch() {
    const modal = dialog.current;
    const host = container.current;
    if (!modal || !host) return;
    if (!modal.open) modal.showModal();
    host.replaceChildren();
    const version = ++request.current;
    const isCurrent = () => dialog.current === modal && modal.open && request.current === version;
    setStatus("loading");
    try {
      const Postcode = await loadKakaoPostcode();
      if (!isCurrent()) return;
      new Postcode({
        width: "100%",
        height: "100%",
        minWidth: 0,
        shorthand: false,
        oncomplete: (result) => {
          if (!isCurrent()) return;
          const address = (result.roadAddress || result.jibunAddress || result.address).trim();
          if (!address) return;
          modal.close();
          onSelect(address);
        },
      }).embed(host);
      setStatus("ready");
    } catch {
      if (isCurrent()) setStatus("error");
    }
  }

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={showSearch}
        className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-neutral-300 bg-white px-2.5 text-sm font-medium whitespace-nowrap text-neutral-900 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-foundy-primary sm:px-3.5">
        <svg aria-hidden="true" className="hidden size-4 sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></svg>
        주소 검색
      </button>
      <dialog ref={dialog} aria-labelledby={title}
        onClose={() => { if (!dialog.current?.open) container.current?.replaceChildren(); }}
        className="m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-xl border border-solid border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl backdrop:bg-black/35 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id={title} className="m-0 text-lg font-semibold">주소 검색</h3>
          <button type="button" aria-label="주소 검색 닫기" onClick={() => dialog.current?.close()}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg bg-transparent text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-foundy-primary">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {status === "loading" && <p role="status" className="my-0 py-5 text-sm text-neutral-600">주소 검색을 불러오는 중이에요.</p>}
        {status === "error" && (
          <div className="space-y-3 py-3">
            <p role="alert" className="m-0 text-sm text-neutral-700">주소 검색을 불러오지 못했어요. 다시 시도하거나 주소를 직접 입력해 주세요.</p>
            <button type="button" onClick={showSearch} className="min-h-11 cursor-pointer rounded-lg bg-foundy-primary px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
              다시 시도
            </button>
          </div>
        )}
        <div ref={container} className={status === "ready" ? "h-[min(500px,70dvh)] min-w-0" : "hidden"} />
      </dialog>
    </>
  );
}
