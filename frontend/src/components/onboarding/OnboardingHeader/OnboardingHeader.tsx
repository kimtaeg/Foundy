import { PageHeader } from "@/components/common/PageHeader";

export interface OnboardingHeaderProps {
  returning: boolean;
  userName: string;
}

export function OnboardingHeader({
  returning,
  userName,
}: OnboardingHeaderProps) {
  return (
    <PageHeader
      eyebrow={returning ? "RE-ANALYSIS" : "WELCOME"}
      title={
        returning
          ? "변경 내용을 반영하고 있어요"
          : `${userName}님, 어떤 가게를 준비하세요?`
      }
      description={
        returning
          ? "영향받는 점검만 다시 돌려요."
          : "처음 한 번만 입력하면 내 계정에 저장돼요. 정한 자리를 기준으로 점검과 상권 분석을 해 드려요."
      }
    />
  );
}
