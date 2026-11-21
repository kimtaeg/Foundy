import { LoginActions } from "@/components/login/LoginActions";
import { LoginBrand } from "@/components/login/LoginBrand";
import { Element } from "@/components/view/Element";

export function LoginCard() {
  return (
    <Element className="nx-authbox">
      <LoginBrand />
      <h1 style={{ margin: "6px 0", fontSize: 24, letterSpacing: "-.04em" }}>
        창업 전, 확인부터.
      </h1>
      <Element as="p" className="nx-muted" style={{ margin: "0 0 8px" }}>
        로그인하면 내 가게 정보와 점검 결과가 내 계정에 저장돼요.
      </Element>
      <LoginActions />
      <Element className="nx-muted" style={{ marginTop: 6 }}>
        “예시 계정으로 둘러보기”는 가입 없이 이서연 씨의 사례를 보여 주는 시연 화면이에요.
      </Element>
    </Element>
  );
}
