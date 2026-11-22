import { ProfileField } from "@/components/mypage/ProfileField";
import type { ProfileFieldEdit, StoreDraft } from "@/types/profile";
import { profileTitle } from "../profile-styles";

export interface StoreDetailsCardProps { draft: StoreDraft; edit?: ProfileFieldEdit }

export function StoreDetailsCard({ draft, edit }: StoreDetailsCardProps) {
  const decided = draft.location === "decided";
  return (
    <section aria-labelledby="profile-store-title" className="min-w-0">
      <div className="mb-3 flex min-h-7 items-center gap-2.5">
        <h2 id="profile-store-title" className={profileTitle}>가게 정보</h2>
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold leading-5 text-neutral-700">
          {decided ? "자리 확정" : "입지 미정"}
        </span>
      </div>
      <dl className="m-0 min-w-0">
        <ProfileField edit={edit} field="name" value={draft.name} />
        <ProfileField edit={edit} field="type" value={draft.type} />
        {decided ? (
          <>
            <ProfileField edit={edit} field="address" value={draft.address} />
            <ProfileField edit={edit} field="detail" value={draft.detail} />
          </>
        ) : <ProfileField edit={edit} field="region" value={draft.region} />}
        <ProfileField edit={edit} field="opening" value={draft.opening} />
        <ProfileField edit={edit} field="birth" value={draft.birth} />
      </dl>
    </section>
  );
}
