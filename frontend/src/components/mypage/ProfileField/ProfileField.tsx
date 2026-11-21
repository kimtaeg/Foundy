import { ImpactHint } from "@/components/mypage/ImpactHint";
import { Element } from "@/components/view/Element";
import { ReactNode } from "react";

export interface ProfileFieldProps {
  label: string;
  hints: string[];
  full?: boolean;
  children: ReactNode;
}

export function ProfileField({
  label,
  hints,
  full = false,
  children,
}: ProfileFieldProps) {
  return (
    <Element as="label" className={`nx-f${full ? " full" : ""}`}>
      {label}
      {children}
      <ImpactHint labels={hints} />
    </Element>
  );
}
