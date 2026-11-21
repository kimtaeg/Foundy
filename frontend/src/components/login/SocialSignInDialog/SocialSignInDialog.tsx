import { Element } from "@/components/view/Element";

export interface SocialSignInDialogProps {
  provider: string;
  providerLabel: string;
}

export function SocialSignInDialog({
  provider,
  providerLabel,
}: SocialSignInDialogProps) {
  return (
    <Element as="form" id="nxSocial" data-p={provider} className="nx-stack">
      <Element className="nx-note">
        시연용 모의 화면이에요. 실제 {providerLabel} 로그인과 연결되어 있지
        않고, 비밀번호 같은 실제 계정 정보는 입력하지 않아요.
      </Element>
      <Element as="label" className="nx-f">
        표시할 이름 *
        <Element
          as="input"
          id="socialName"
          required
          maxLength={12}
          placeholder="예: 김창업"
        />
      </Element>
      <Element as="button" className="nx-btn" type="submit">
        계속하기
      </Element>
      <Element className="nx-muted">
        같은 이름으로 다시 들어오면 저장된 가게 정보가 나와요.
      </Element>
    </Element>
  );
}
