import { Element } from "@/components/view/Element";

export function DataManagementCard() {
  return (
    <Element as="section" className="nx-card">
      <h3>데이터 관리</h3>
      <Element className="nx-muted">
        가게 정보를 지우고 처음 선택(자리를 정했는지)부터 다시 시작할 수 있어요.
        다른 계정의 데이터는 그대로예요.
      </Element>
      <Element className="nx-row" style={{ marginTop: 10 }}>
        <Element as="button" className="nx-btn outline" data-nx="mpwipe">
          가게 정보 처음부터 다시 설정
        </Element>
      </Element>
    </Element>
  );
}
