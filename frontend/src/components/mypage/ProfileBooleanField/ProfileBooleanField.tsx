import { ImpactHint } from "@/components/mypage/ImpactHint";
import { Element } from "@/components/view/Element";

export interface ProfileBooleanFieldProps {
  field: string;
  label: string;
  /** null 은 아직 답하지 않음 (둘 다 선택 안 됨) */
  value: boolean | null;
  hints: string[];
  /** 카드 선택으로 저장값과 다르게 적용 중인 값 안내 */
  note?: string;
}

export function ProfileBooleanField({
  field,
  label,
  value,
  hints,
  note,
}: ProfileBooleanFieldProps) {
  return (
    <Element className="nx-f">
      {label}
      <Element className="options">
        <Element
          as="button"
          type="button"
          className={`nx-yn ${value === true ? "on" : ""}`}
          data-nx="mpyn"
          data-k={field}
          data-v="1"
        >
          네
        </Element>
        <Element
          as="button"
          type="button"
          className={`nx-yn ${value === false ? "on" : ""}`}
          data-nx="mpyn"
          data-k={field}
          data-v="0"
        >
          아니요
        </Element>
      </Element>
      {note && (
        <Element as="small" className="nx-muted" data-effective-note={field}>
          {note}
        </Element>
      )}
      <ImpactHint labels={hints} />
    </Element>
  );
}
