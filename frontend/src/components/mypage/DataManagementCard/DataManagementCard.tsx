import { profileTitle } from "../profile-styles";

export interface DataManagementCardProps {
  canReset?: boolean;
}

export function DataManagementCard({ canReset = true }: DataManagementCardProps) {
  return (
    <section aria-labelledby="profile-data-title" className="min-w-0 border-0 border-t border-solid border-neutral-200 pt-7 lg:border-t-0 lg:pt-0">
      <h2 id="profile-data-title" className={profileTitle}>데이터 관리</h2>
      <p className="mb-4 mt-3 max-w-prose break-keep text-[15px] leading-relaxed text-neutral-600">
        {canReset ? "이 계정의 가게 정보와 준비 내역을 지우고, 자리 선택부터 다시 시작해요." : "현재 계정은 가게 정보 초기화를 지원하지 않아요."}
      </p>
      <button type="button" disabled={!canReset} data-nx={canReset ? "mpwipe" : undefined} className="min-h-11 rounded-lg border border-solid border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50">
        가게 정보 초기화
      </button>
    </section>
  );
}
