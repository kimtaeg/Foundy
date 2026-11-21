import { useFeatureData } from "@/hooks/useFeatureData";
import { type ProfileViewModel, type StoreChange } from "@/types/profile";

export function useProfile(): ProfileViewModel | null {
  const { context, profileView, apiPending } = useFeatureData("mypage");
  if (!context) return null;
  if (apiPending) return null; // 서버 가게 정보를 받기 전에는 로컬 값으로 폼을 채우지 않는다
  const base = {
    onboarded: context.S.onboarded,
    draft: context.mpDraft(),
    profile: context.profile(),
    providerLabel: context.provLabel(context.profile().provider),
    impacts: context.IMP,
    fields: context.MPF,
    regions: context.REGIONS,
  };
  // 서버 연결 모드: 폼은 서버 저장값, 영향·초기화 카드는 서버 미리보기 응답 (프론트 고정 영향표로 계산하지 않는다)
  if (profileView) return profileView({ ...base, changes: [], affectedLabels: [], resetCards: [] });
  // 서버를 쓰지 않는 데모 모드: 기존 로컬 계산 그대로
  const changes: StoreChange[] = context.mpDiff();
  const affected = context.mpImpacts(changes);
  return {
    ...base,
    changes,
    affectedLabels: [...affected.set].map((key) => context.IMP[key]),
    resetCards: context.resetList(affected.cardIds),
  };
}
