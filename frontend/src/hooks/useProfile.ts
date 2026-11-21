import { useFeatureData } from "@/hooks/useFeatureData";
import { type ProfileViewModel, type StoreChange } from "@/types/profile";

export function useProfile(): ProfileViewModel | null {
  const { context } = useFeatureData("mypage");
  if (!context) return null;
  const changes: StoreChange[] = context.mpDiff();
  const affected = context.mpImpacts(changes);
  return {
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
