import { Element } from "@/components/view/Element";

export function DemoScenarioBanner() {
  return (
    <Element className="nx-banner" style={{ margin: "8px 0 4px" }}>
      <div>
        <b>입력 없이 흐름 확인하기</b>
        <Element className="nx-muted">
          이서연 씨의 시나리오로 끝까지 보여드려요 · 예시 데이터
        </Element>
      </div>
      <Element as="button" className="nx-btn" type="button" data-nx="demo">
        예시로 해보기
      </Element>
    </Element>
  );
}
