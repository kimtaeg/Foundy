import { Element } from "@/components/view/Element";
import Link from "next/link";

/** 아이디·비밀번호 로그인 폼. 제출은 EventBoundary의 submit 이벤트(id nxPwLogin)로 처리한다. */
export function PasswordLoginForm() {
  return (
    <Element as="form" id="nxPwLogin" className="nx-stack" autoComplete="on">
      <Element as="label" className="nx-f">
        아이디
        <Element
          as="input"
          id="pwLoginId"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          maxLength={20}
          placeholder="영문 소문자·숫자 4~20자"
        />
      </Element>
      <Element as="label" className="nx-f">
        비밀번호
        <Element
          as="input"
          id="pwLoginPw"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="비밀번호"
        />
      </Element>
      <Element as="button" className="nx-btn" type="submit" style={{ justifyContent: "center" }}>
        로그인
      </Element>
      <Element className="nx-muted" style={{ textAlign: "center" }}>
        아직 계정이 없나요? <Link href="/signup">회원가입</Link>
      </Element>
    </Element>
  );
}
