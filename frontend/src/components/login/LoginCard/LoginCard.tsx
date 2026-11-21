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
        시연용 화면이에요. 실제 소셜 로그인과 연결되어 있지 않고, 입력한 이름과
        가게 정보는 이 브라우저에만 저장돼요.
      </Element>
    </Element>
  );
}
