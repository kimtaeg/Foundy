import { PasswordLoginForm } from "@/components/login/PasswordLoginForm";
import { Element } from "@/components/view/Element";

export function LoginActions() {
  return (
    <>
      <PasswordLoginForm />
      <Element className="nx-or">
        <span>또는</span>
      </Element>
      <Element
        as="button"
        className="nx-btn outline"
        data-nx="demologin"
        style={{ justifyContent: "center" }}
      >
        예시 계정으로 둘러보기 (이서연)
      </Element>
    </>
  );
}
