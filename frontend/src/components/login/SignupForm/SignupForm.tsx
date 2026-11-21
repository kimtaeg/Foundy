import { Element } from "@/components/view/Element";
import Link from "next/link";

/** 회원가입 폼. 제출은 EventBoundary의 submit 이벤트(id nxPwSignup)로 처리한다. */
export function SignupForm() {
  return (
    <Element as="form" id="nxPwSignup" className="nx-stack" autoComplete="on">
      <Element as="label" className="nx-f">
        아이디 *
        <Element
          as="input"
          id="pwSignupId"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          minLength={4}
          maxLength={20}
          pattern="[a-z0-9]{4,20}"
          placeholder="영문 소문자·숫자 4~20자"
        />
      </Element>
      <Element as="label" className="nx-f">
        이름 *
        <Element
          as="input"
          id="pwSignupName"
          name="name"
          autoComplete="name"
          required
          maxLength={30}
          placeholder="예: 김창업"
        />
      </Element>
      <Element as="label" className="nx-f">
        비밀번호 *
        <Element
          as="input"
          id="pwSignupPw"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="8자 이상"
        />
      </Element>
      <Element as="label" className="nx-f">
        비밀번호 확인 *
        <Element
          as="input"
          id="pwSignupPw2"
          name="password-confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="비밀번호를 한 번 더 입력"
        />
      </Element>
      <Element as="button" className="nx-btn" type="submit" style={{ justifyContent: "center" }}>
        가입하고 시작하기
      </Element>
      <Element className="nx-muted" style={{ textAlign: "center" }}>
        이미 계정이 있나요? <Link href="/login">로그인</Link>
      </Element>
    </Element>
  );
}
