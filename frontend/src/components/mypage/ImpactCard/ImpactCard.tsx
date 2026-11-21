import { ResetCardNotice } from "@/components/mypage/ResetCardNotice";
import { Element } from "@/components/view/Element";
import { type ProfileViewModel } from "@/types/profile";

export type ImpactCardProps = Pick<ProfileViewModel, "changes" | "affectedLabels" | "resetCards">;

export function ImpactCard({
  changes,
  affectedLabels,
  resetCards,
}: ImpactCardProps) {
  if (!changes.length) return null;
  return (
    <Element as="section" className="nx-card nx-sticky" id="mpImpact">
      {!!affectedLabels.length && (
        <>
          <Element className="nx-seg-title">다시 반영되는 것</Element>
          <Element as="ul" className="nx-ul">
            {affectedLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </Element>
        </>
      )}
      <ResetCardNotice cards={resetCards} />
      <Element className="nx-row">
        <Element as="button" className="nx-btn" data-nx="mpsave">
          저장하고 다시 반영
        </Element>
        <Element as="button" className="nx-btn outline" data-nx="mpreset">
          되돌리기
        </Element>
      </Element>
    </Element>
  );
}
