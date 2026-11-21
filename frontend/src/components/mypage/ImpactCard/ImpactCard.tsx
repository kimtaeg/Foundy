import { ResetCardNotice } from "@/components/mypage/ResetCardNotice";
import { Element } from "@/components/view/Element";
import { type ProfileViewModel } from "@/types/profile";

export type ImpactCardProps = Pick<ProfileViewModel, "changes" | "affectedLabels" | "resetCards" | "preview">;

export function ImpactCard({
  changes,
  affectedLabels,
  resetCards,
  preview,
}: ImpactCardProps) {
  if (!changes.length) return null;
  // 서버 연결 모드: 서버 미리보기가 성공한 최신 입력만 저장할 수 있다
  const blocked = preview ? !preview.canSave : false;
  return (
    <Element as="section" className="nx-card nx-sticky" id="mpImpact" data-preview={preview?.status}>
      {preview?.status === "loading" && (
        <Element as="p" className="nx-muted">바뀐 내용의 영향을 서버에서 확인하고 있어요…</Element>
      )}
      {preview?.status === "error" && (
        <Element className="nx-cons" role="alert">
          <b>영향을 확인하지 못했어요</b>
          <br />
          {preview.error}
          <br />
          <Element as="span" className="nx-muted">입력을 확인하거나 잠시 후 다시 시도해 주세요. 확인이 끝나야 저장할 수 있어요.</Element>
        </Element>
      )}
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
      {preview?.status === "ready" && !preview.needsReanalyze && (
        <Element as="p" className="nx-muted">외부 조회 없이 바로 반영돼요.</Element>
      )}
      <ResetCardNotice cards={resetCards} />
      {preview?.status === "ready" && !!preview.lines.length && (
        <Element as="ul" className="nx-ul" data-preview-lines="">
          {preview.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </Element>
      )}
      <Element className="nx-row">
        <Element as="button" className="nx-btn" data-nx="mpsave" disabled={blocked} aria-disabled={blocked}>
          {preview?.saving ? "저장하는 중…" : "저장하고 다시 반영"}
        </Element>
        <Element as="button" className="nx-btn outline" data-nx="mpreset">
          되돌리기
        </Element>
      </Element>
    </Element>
  );
}
