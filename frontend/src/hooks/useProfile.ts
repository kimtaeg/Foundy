import { EMPTY_STORE, IMP, MPF, REGIONS } from "@/data/store";
import { formFromStore } from "@/lib/api/store-update";
import { provLabel } from "@/lib/format-provider";
import { useFeatureData } from "@/hooks/useFeatureData";
import { isBooleanProfileField } from "@/lib/profile/editable-fields";
import type { EditableProfileField, ProfileViewModel, StoreChange } from "@/types/profile";

type PendingSave = { field: EditableProfileField; value: string | boolean };

export function useProfile(pending?: PendingSave): ProfileViewModel | null {
  const { context, api, apiActive, snapshot } = useFeatureData("mypage");
  if (apiActive) {
    const me = api?.bundle.me;
    const store = api?.bundle.store;
    const onboarded = snapshot?.onboarded ?? false;
    if (!me || (onboarded && !store)) return null;
    const form = store && onboarded ? formFromStore(store) : null;
    const { field, value } = pending ?? {};
    if (form && field && field !== "accountName" && field !== "region") {
      if (isBooleanProfileField(field)) {
        if (typeof value === "boolean") form[field] = value;
      } else if (typeof value === "string") {
        form[field] = value;
      }
    }
    return {
      onboarded,
      draft: form ? {
        name: form.name, type: form.type, address: form.address, detail: form.detail, opening: form.opening,
        birth: form.birth, area: form.area, funds: form.funds, region: store?.region ?? "", location: "decided",
        alcohol: !!form.alcohol, employees: !!form.employees, terrace: !!form.terrace,
      } : { ...EMPTY_STORE, birth: "", area: "", funds: "" },
      answers: form ? { alcohol: form.alcohol, employees: form.employees, terrace: form.terrace } : undefined,
      profile: {
        name: field === "accountName" && typeof value === "string" ? value : me.user.name,
        provider: me.user.provider,
        joined: me.user.joined_at?.slice(0, 10),
      },
      providerLabel: me.user.provider === "local" ? "아이디 계정" : provLabel(me.user.provider),
      canReset: false,
      impacts: IMP, fields: MPF, regions: REGIONS, changes: [], affectedLabels: [], resetCards: [],
    };
  }
  if (!context) return null;
  const changes: StoreChange[] = context.mpDiff();
  const affected = context.mpImpacts(changes);
  return {
    edit: context.edit,
    onboarded: context.S.onboarded,
    draft: context.mpDraft(),
    profile: context.profile(),
    providerLabel: context.provLabel(context.profile().provider),
    impacts: context.IMP,
    fields: context.MPF,
    regions: context.REGIONS,
    changes,
    affectedLabels: [...affected.set].map((key) => context.IMP[key]),
    resetCards: context.resetList(affected.cardIds),
  };
}
