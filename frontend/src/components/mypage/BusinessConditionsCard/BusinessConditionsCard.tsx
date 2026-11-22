import { ProfileField } from "@/components/mypage/ProfileField";
import { ProfileBooleanField } from "@/components/mypage/ProfileBooleanField";
import { won } from "@/lib/format";
import { profileFieldLabels } from "@/lib/profile/editable-fields";
import type { ProfileFieldEdit, ProfileViewModel, StoreDraft } from "@/types/profile";
import { profileTitle } from "../profile-styles";

export interface BusinessConditionsCardProps { draft: StoreDraft; edit?: ProfileFieldEdit; answers?: ProfileViewModel["answers"] }

export function BusinessConditionsCard({ draft, edit, answers }: BusinessConditionsCardProps) {
  return (
    <section aria-labelledby="profile-business-title" className="min-w-0 border-0 border-t border-solid border-neutral-200 pt-7 lg:border-t-0 lg:pt-0">
      <h2 id="profile-business-title" className={profileTitle}>영업 조건</h2>
      <dl className="m-0 mt-3">
        {(["alcohol", "terrace", "employees"] as const).map((field) => (
          <div key={field} className="flex min-w-0 items-center justify-between gap-3 border-0 border-b border-solid border-neutral-100 py-2.5">
            <dt className="text-[15px] font-medium leading-6 text-neutral-900">{profileFieldLabels[field]}</dt>
            <dd className="m-0 shrink-0"><ProfileBooleanField field={field} value={answers ? answers[field] : draft[field]} /></dd>
          </div>
        ))}
        <ProfileField edit={edit} field="funds" value={draft.funds == null || draft.funds === "" ? "" : won(draft.funds)} />
      </dl>
    </section>
  );
}
