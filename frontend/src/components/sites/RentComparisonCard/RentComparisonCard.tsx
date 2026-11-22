"use client";
import { useEffect, useState, type FormEvent } from "react";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { won } from "@/lib/format";
import { rentDiffText } from "@/lib/market/rent";
import type { ApiRent, ApiRentQuery } from "@/lib/api/types";

export interface RentComparisonCardProps {
  /** 임대료 비교를 불러오는 함수. 없으면(서버 연결 없음) 비교할 수 없다고 안내한다 */
  source?: (query: ApiRentQuery) => Promise<ApiRent>;
  /** 처음 그릴 결과 (테스트·서버 렌더링용) */
  initial?: ApiRent;
}

const UNAVAILABLE = "임대료 통계를 아직 불러올 수 없어요";
const field = "block min-h-11 w-full min-w-0 rounded-lg border border-solid border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-foundy-primary focus-visible:outline-foundy-primary";

const manwon = (value: string) => (value.trim() === "" ? undefined : Math.round(Number(value) * 10_000));
const numberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));

export function RentComparisonCard({ source, initial }: RentComparisonCardProps) {
  const [result, setResult] = useState<ApiRent | undefined>(initial);
  const [loading, setLoading] = useState(Boolean(source && !initial));
  const [failed, setFailed] = useState(false);
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [area, setArea] = useState("");

  useEffect(() => {
    if (!source || initial) return;
    let current = true;
    source({}).then(
      (next) => { if (current) { setResult(next); setFailed(false); } },
      () => { if (current) setFailed(true); },
    ).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [source, initial]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source) return;
    setLoading(true);
    try {
      setResult(await source({ monthly_rent: manwon(rent), deposit: manwon(deposit) ?? 0, area: numberOrUndefined(area) }));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const unavailable = !source || failed || result?.status === "unavailable";
  const average = unavailable ? null : result?.average ?? null;
  const comparison = unavailable ? null : result?.comparison ?? null;
  const diff = result && !unavailable ? rentDiffText(result) : null;
  const max = comparison ? Math.max(comparison.mine_krw_per_sqm, comparison.average_krw_per_sqm) : 0;

  return (
    <MarketPanelCard title="임대료 비교" description="월세·보증금을 넣으면 한국부동산원 통계의 같은 상권 소규모 상가 ㎡당 임대료와 비교해요. 저장하지 않아요.">
      {result?.is_example && !unavailable && (
        <p className="mb-3 mt-0 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">예시 · 실제 통계 아님</p>
      )}
      <form onSubmit={submit} aria-label="임대료 비교 입력" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-neutral-800">
          월세 (만원)
          <input name="monthly_rent" type="number" inputMode="numeric" min={0} required value={rent} onChange={(e) => setRent(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-800">
          보증금 (만원)
          <input name="deposit" type="number" inputMode="numeric" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-800">
          임대면적 (㎡, 선택)
          <input name="area" type="number" inputMode="decimal" min={0} step="0.1" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder={result?.inputs.area_sqm ? `영업장 ${result.inputs.area_sqm}㎡` : "계약서 임대면적"} className={field} />
        </label>
        <button type="submit" disabled={!source || loading}
          className="min-h-11 cursor-pointer rounded-lg border-0 bg-foundy-primary px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-50 sm:col-span-3">
          {loading ? "비교하는 중…" : "비교하기"}
        </button>
      </form>

      <div className="mt-4" role="status" aria-live="polite">
        {unavailable ? (
          <p className="m-0 rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">{UNAVAILABLE}</p>
        ) : average ? (
          <div className="grid gap-3">
            {comparison && diff && <p className="m-0 text-base font-semibold text-neutral-900">{diff}</p>}
            <dl className="m-0 grid gap-2 text-sm">
              {comparison && (
                <div className="grid gap-1">
                  <dt className="text-neutral-600">내 ㎡당 환산 월세</dt>
                  <dd className="m-0 flex items-center gap-2 font-semibold text-neutral-900">
                    <span className="h-2 rounded-full bg-foundy-primary" style={{ width: `${(comparison.mine_krw_per_sqm / max) * 60}%` }} aria-hidden="true" />
                    {won(comparison.mine_krw_per_sqm)}/㎡
                  </dd>
                </div>
              )}
              <div className="grid gap-1">
                <dt className="text-neutral-600">{average.area_name.split(">").pop()} {average.building_type} 평균</dt>
                <dd className="m-0 flex items-center gap-2 font-semibold text-neutral-900">
                  <span className="h-2 rounded-full bg-neutral-400" style={{ width: `${max ? (average.krw_per_sqm / max) * 60 : 30}%` }} aria-hidden="true" />
                  {won(average.krw_per_sqm)}/㎡
                </dd>
              </div>
            </dl>
            {result?.status === "need_input" && result.missing.includes("area") && (
              <p className="m-0 text-sm text-neutral-600">영업장 면적이 없어요. 임대면적을 넣거나 마이페이지에서 영업장 면적을 입력해 주세요.</p>
            )}
            {result?.notes.map((note) => <p key={note} className="m-0 text-xs leading-relaxed text-neutral-600">{note}</p>)}
            <p className="m-0 text-xs leading-relaxed text-neutral-500">
              비교 기준: {result?.basis.rent} · {result?.basis.area} · {result?.basis.floor}
              <br />
              출처: {average.source} · {average.period} · {average.building_type} · {average.area_name.replaceAll(">", " ")}
            </p>
          </div>
        ) : loading ? (
          <p className="m-0 text-sm text-neutral-600">통계를 불러오고 있어요…</p>
        ) : null}
      </div>
    </MarketPanelCard>
  );
}
