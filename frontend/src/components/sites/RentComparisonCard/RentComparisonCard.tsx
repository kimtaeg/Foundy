"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { manwonText, won } from "@/lib/format";
import { manwonInputToKrw, perPyeongManwon, rentDiffShort, rentScopeName, rentView, toManwon } from "@/lib/market/rent";
import {
  createRentRequester, rentLocationKey, rentLocationLabel, rentLocationProblem, rentLocationQuery,
} from "@/lib/market/rent-location";
import type { ApiRent, ApiRentQuery } from "@/lib/api/types";
import type { MarketPoint } from "@/types/market";

export interface RentComparisonCardProps {
  /** 임대료 비교를 불러오는 함수. 없으면(서버 연결 없음) 비교할 수 없다고 안내한다 */
  source?: (query: ApiRentQuery) => Promise<ApiRent>;
  /** 처음 그릴 결과 (테스트·서버 렌더링용) */
  initial?: ApiRent;
  /** 지금 지도 중심. 처음 위치와 다르면 그 좌표 기준으로 다시 계산한다 (#199) */
  center?: MarketPoint;
  /** 처음 지도 중심(가게 주소 위치). 지도 중심이 이 위치면 가게 주소 기준으로 계산한다 */
  origin?: MarketPoint;
}

const UNAVAILABLE = "임대료 통계를 아직 불러올 수 없어요";
const field = "block min-h-11 w-full min-w-0 rounded-lg border border-solid border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-foundy-primary focus-visible:outline-foundy-primary";
const numberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));
const approxManwon = (krw: number) => `약 ${manwonText(toManwon(krw))}`;

export function RentComparisonCard({ source, initial, center, origin }: RentComparisonCardProps) {
  const [result, setResult] = useState<ApiRent | undefined>(initial);
  const [loading, setLoading] = useState(Boolean(source && !initial));
  const [failed, setFailed] = useState(false);
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [area, setArea] = useState("");
  const location = rentLocationQuery(center, origin);
  const locationKey = rentLocationKey(location);

  // 요청 관리: 지도 위치 변경은 잠시 기다렸다 한 번만, 제출한 입력은 유지, 늦게 온 이전 응답은 버린다
  const requester = useMemo(() => source ? createRentRequester({
    source,
    location,
    onStart: () => setLoading(true),
    onResult: (next) => { setResult(next); setFailed(false); },
    onError: () => setFailed(true),
    onSettled: () => setLoading(false),
  }) : null,
  // 위치는 처음 값만 넘기고, 이후 변경은 moveTo 로 알린다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [source]);

  useEffect(() => {
    if (!requester) return;
    if (!initial) void requester.load();
    return () => requester.dispose();
  }, [requester, initial]);

  useEffect(() => {
    requester?.moveTo(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requester, locationKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requester) return;
    await requester.submit({ monthly_rent: manwonInputToKrw(rent), deposit: manwonInputToKrw(deposit) ?? 0, area: numberOrUndefined(area) });
  }

  // 통계가 없으면(unavailable·서버 없음·호출 실패) view 는 null 이고 숫자를 하나도 그리지 않는다
  const view = !source || failed || !result ? null : rentView(result);
  const unavailable = !source || failed || (result !== undefined && !view);
  const headline = view?.headline;
  const comparison = view && result?.status === "ready" ? result.comparison : null;
  const diff = comparison && result ? rentDiffShort(result) : null;
  const myArea = result?.inputs.area_sqm ?? null;
  const needArea = result?.status === "need_input" && result.missing.includes("area");
  const locationLabel = !failed ? rentLocationLabel(result) : null;
  const locationProblem = !failed ? rentLocationProblem(result) : null;

  return (
    <MarketPanelCard title="주변 상가 임대료 분석">
      {result?.is_example && view && (
        <p className="mb-2 mt-0 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">예시 · 실제 통계 아님</p>
      )}
      {locationLabel && (
        <p className="mb-2 mt-0 text-xs font-semibold text-foundy-primary" data-rent-location>{locationLabel}</p>
      )}

      <div role="status" aria-live="polite" aria-busy={loading}>
        {unavailable ? (
          <div className="m-0 rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
            <p className="m-0">{UNAVAILABLE}</p>
            {locationProblem && <p className="m-0 mt-1 text-xs">{locationProblem}</p>}
          </div>
        ) : headline ? (
          <div className="grid gap-1">
            <p className="m-0 text-sm text-neutral-600">
              {rentScopeName(headline)} · {headline.building_type} · {headline.floor_label} 평균 (보증금 환산 포함)
            </p>
            {headline.monthly_for_my_area_krw !== null && myArea ? (
              <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">{approxManwon(headline.monthly_for_my_area_krw)}/월</span>
                <span className="text-sm text-neutral-600">내 면적 {myArea}㎡ 기준 ({won(headline.krw_per_sqm)}/㎡)</span>
              </p>
            ) : (
              <>
                <p className="m-0 text-xl font-bold tracking-tight text-neutral-900">
                  {won(headline.krw_per_sqm)}/㎡ · 3.3㎡당 약 {manwonText(perPyeongManwon(headline.krw_per_sqm))}
                </p>
                <p className="m-0 text-sm text-neutral-600">임대면적을 넣으면 월 금액으로 보여 줘요</p>
              </>
            )}
          </div>
        ) : loading ? (
          <p className="m-0 text-sm text-neutral-600">통계를 불러오고 있어요…</p>
        ) : null}
        {loading && result && (
          // 다시 계산하는 동안 이전 결과는 지우지 않고 그대로 둔다
          <p className="m-0 mt-1 text-xs text-neutral-500">새 위치·입력으로 다시 계산하고 있어요…</p>
        )}
      </div>

      <form onSubmit={submit} aria-label="임대료 비교 입력" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            placeholder={myArea ? `영업장 ${myArea}㎡` : "계약서 임대면적"} className={field} />
        </label>
        <button type="submit" disabled={!source || loading}
          className="min-h-11 cursor-pointer rounded-lg border-0 bg-foundy-primary px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-50 sm:col-span-3">
          {loading ? "비교하는 중…" : "비교하기"}
        </button>
      </form>
      {view && needArea && (
        <p className="mb-0 mt-2 text-sm text-neutral-600">임대면적을 넣거나 마이페이지에서 영업장 면적을 입력해 주세요</p>
      )}

      {view && (
        <div className="mt-4 grid gap-4">
          {comparison && (
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-xl bg-neutral-50 p-3">
                <p className="m-0 text-xs text-neutral-600">내 환산 월세</p>
                <p className="m-0 mt-1 text-lg font-bold text-neutral-900">{manwonText(toManwon(comparison.converted_monthly_krw))}</p>
                <p className="m-0 mt-1 break-keep text-xs text-neutral-500">
                  월세 {toManwon(comparison.converted_monthly_krw - comparison.deposit_monthly_krw)}만 + 보증금 환산 {toManwon(comparison.deposit_monthly_krw)}만
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-neutral-50 p-3">
                <p className="m-0 text-xs text-neutral-600">평균 대비</p>
                <p className="m-0 mt-1 text-lg font-bold text-neutral-900">{diff ?? "—"}</p>
              </div>
            </div>
          )}

          {view.rows && (
            <div className="min-w-0">
              <h4 className="m-0 text-sm font-semibold text-neutral-900">같은 상권 비교 ({view.source.period})</h4>
              <table className="mt-2 w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th scope="col" className="w-[38%] py-1 pr-2 font-medium">구분</th>
                    <th scope="col" className="py-1 pr-2 text-right font-medium">㎡당</th>
                    <th scope="col" className="py-1 text-right font-medium">{myArea ? `내 면적(${myArea}㎡)이면` : "내 면적이면"}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row) => (
                    <tr key={row.label} aria-current={row.is_my_floor ? "true" : undefined}
                      className={`border-0 border-t border-solid border-neutral-200 ${row.is_my_floor ? "bg-foundy-primary/5 font-semibold text-neutral-900" : "text-neutral-700"}`}>
                      <th scope="row" className="break-keep py-2 pr-2 text-left font-[inherit]">
                        {row.label}
                        {row.is_my_floor && <span className="ml-1 whitespace-nowrap text-xs text-foundy-primary">◀ 내 층</span>}
                      </th>
                      <td className="py-2 pr-2 text-right tabular-nums">{won(row.krw_per_sqm)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {row.monthly_for_my_area_krw !== null && myArea ? approxManwon(row.monthly_for_my_area_krw) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(view.readings.length > 0 || (result?.notes.length ?? 0) > 0) && (
            <div className="min-w-0">
              <h4 className="m-0 text-sm font-semibold text-neutral-900">이 숫자 읽는 법</h4>
              {view.readings.length > 0 && (
                <ul className="m-0 mt-2 grid gap-1 pl-5 text-sm leading-relaxed text-neutral-700">
                  {view.readings.map((reading) => <li key={reading}>{reading}</li>)}
                </ul>
              )}
              {result?.notes.map((note) => <p key={note} className="mb-0 mt-2 text-xs leading-relaxed text-neutral-600">{note}</p>)}
            </div>
          )}

          <p className="m-0 text-xs leading-relaxed text-neutral-500">
            {view.source.name} · {view.source.period} · {view.headline.building_type} · 비교 기준: {result?.basis.rent} · {result?.basis.area} · {result?.basis.floor}
          </p>
        </div>
      )}
    </MarketPanelCard>
  );
}
