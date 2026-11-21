import { Element } from "@/components/view/Element";

export interface OptionConfirmDialogProps {
  cardId: string;
  optionId: string;
  label: string;
  summary: string;
  changes: string[];
  recommended: boolean;
  reason?: string;
  meta: string;
}
export function OptionConfirmDialog({
  cardId,
  optionId,
  label,
  summary,
  changes,
  recommended,
  reason,
  meta,
}: OptionConfirmDialogProps) {
  return (
    <>
      <Element className="nx-badges">
        <b>{label}</b>
        {recommended && (
          <Element as="span" className="nx-badge ok">
            추천
          </Element>
        )}
      </Element>
      <Element as="p" className="nx-muted">
        {summary}
        {meta && ` · ${meta}`}
      </Element>
      {reason && (
        <>
          <Element className="nx-seg-title">추천하는 이유</Element>
          <Element as="p" className="nx-muted">
            {reason}
          </Element>
        </>
      )}
      <Element className="nx-seg-title">적용하면 이렇게 바뀌어요</Element>
      <Element as="ul" className="nx-ul">
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </Element>
      <Element className="nx-row">
        <Element
          as="button"
          className="nx-btn"
          data-nx="confirm"
          data-id={cardId}
          data-o={optionId}
        >
          확인
        </Element>
      </Element>
    </>
  );
}
