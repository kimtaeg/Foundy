import { ProfileField } from "@/components/mypage/ProfileField";
import type { AccountProfile, ProfileFieldEdit } from "@/types/profile";
import { profileTitle } from "../profile-styles";

export interface AccountCardProps {
  edit?: ProfileFieldEdit;
  profile: AccountProfile;
  providerLabel: string;
}

export function AccountCard({ profile, providerLabel, edit }: AccountCardProps) {
  return (
    <section aria-labelledby="profile-account-title" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="profile-account-title" className={profileTitle}>내 계정</h2>
        <button type="button" data-nx="logout" className="min-h-9 rounded-md border-0 bg-transparent px-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
          로그아웃
        </button>
      </div>
      <dl className="m-0"><ProfileField edit={edit} field="accountName" value={profile.name} /></dl>
      <dl className="mb-0 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-6">
        <div className="flex flex-wrap gap-x-2"><dt className="text-neutral-600">로그인 방식</dt><dd className="m-0 font-medium text-neutral-900">{providerLabel}</dd></div>
        {profile.joined && (
          <div className="flex flex-wrap gap-x-2"><dt className="text-neutral-600">가입일</dt><dd className="m-0 font-medium text-neutral-900 tabular-nums">{profile.joined}</dd></div>
        )}
      </dl>
    </section>
  );
}
