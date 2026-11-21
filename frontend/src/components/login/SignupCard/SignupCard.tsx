import { LoginBrand } from "@/components/login/LoginBrand";
import { SignupForm } from "@/components/login/SignupForm";
import { Element } from "@/components/view/Element";

export function SignupCard() {
  return (
    <Element className="nx-authbox">
      <LoginBrand />
      <h1 style={{ margin: "6px 0", fontSize: 24, letterSpacing: "-.04em" }}>회원가입</h1>
      <Element as="p" className="nx-muted" style={{ margin: "0 0 8px" }}>
        아이디와 비밀번호만 있으면 돼요. 가입하면 내 가게 정보와 점검 결과가 내 계정에 저장돼요.
      </Element>
      <SignupForm />
    </Element>
  );
}
