import { Element } from "@/components/view/Element";

export interface SocialLoginButtonProps {
  provider: string;
  label: string;
}

export function SocialLoginButton({
  provider,
  label,
}: SocialLoginButtonProps) {
  return (
    <Element
      as="button"
      className={`nx-social ${provider}`}
      data-nx="social"
      data-p={provider}
    >
      {label}로 시작하기
    </Element>
  );
}
