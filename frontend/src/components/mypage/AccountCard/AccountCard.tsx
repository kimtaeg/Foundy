import { Element } from "@/components/view/Element";
import { type AccountProfile } from "@/types/profile";

export interface AccountCardProps {
  profile: AccountProfile;
  providerLabel: string;
}

export function AccountCard({
  profile,
  providerLabel,
}: AccountCardProps) {
  return (
    <Element as="section" className="nx-card">
      <Element className="nx-heading">
        <h3>내 계정</h3>
        <Element as="button" className="nx-btn outline slim" data-nx="logout">
          로그아웃
        </Element>
      </Element>
      <Element className="nx-form">
        <Element as="label" className="nx-f">
          이름
          <Element as="input" id="uname" maxLength={12} value={profile.name} />
        </Element>
        <Element className="nx-f">
          로그인 방식
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
            {providerLabel}
          </div>
          <small>
            가입일 {profile.joined || ""} · 이름을 바꿔도 점검 결과에는 영향이
            없어요
          </small>
        </Element>
      </Element>
      <Element className="nx-row" style={{ marginTop: 10 }}>
        <Element
          as="button"
          className="nx-btn outline slim"
          data-nx="unamesave"
        >
          이름 저장
        </Element>
      </Element>
    </Element>
  );
}
