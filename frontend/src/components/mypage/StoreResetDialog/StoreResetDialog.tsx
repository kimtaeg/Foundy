import { Element } from "@/components/view/Element";

export function StoreResetDialog() {
  return (
    <>
      <Element as="p" className="nx-muted">
        이 계정의 가게 정보, 점검 결과, 체크리스트 진행 상태가 지워지고 첫
        선택(자리를 정했는지)부터 다시 시작해요. 되돌릴 수 없어요.
      </Element>
      <Element className="nx-row">
        <Element as="button" className="nx-btn" data-nx="mpwipego">
          지우고 다시 설정
        </Element>
      </Element>
    </>
  );
}
