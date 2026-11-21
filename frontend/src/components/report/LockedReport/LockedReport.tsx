import { Element } from "@/components/view/Element";

export function LockedReport() {
  return (
    <Element className="nx-card nx-lock">
      <h3>🔒 자리를 정하면 시작돼요</h3>
      <Element as="p" className="nx-muted">
        건물 용도·위반건축물 점검은 주소가 있어야 조회할 수 있어요. 상권
        분석에서 후보 상권을 비교하고 “여기로 정하기”를 눌러 주소를 입력하세요.
      </Element>
      <Element as="button" className="nx-btn" data-nx="go" data-p="sites">
        상권 분석으로 이동
      </Element>
    </Element>
  );
}
