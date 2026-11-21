import { ImpactHint } from "@/components/mypage/ImpactHint";
import { Element } from "@/components/view/Element";

export interface ProfileBooleanFieldProps {
  field: string;
  label: string;
  value: boolean;
  hints: string[];
}

export function ProfileBooleanField({
  field,
  label,
  value,
  hints,
}: ProfileBooleanFieldProps) {
  return (
    <Element className="nx-f">
      {label}
      <Element className="options">
        <Element
          as="button"
          type="button"
          className={`nx-yn ${value ? "on" : ""}`}
          data-nx="mpyn"
          data-k={field}
          data-v="1"
        >
          네
        </Element>
        <Element
          as="button"
          type="button"
          className={`nx-yn ${!value ? "on" : ""}`}
          data-nx="mpyn"
          data-k={field}
          data-v="0"
        >
          아니요
        </Element>
      </Element>
      <ImpactHint labels={hints} />
    </Element>
  );
}
