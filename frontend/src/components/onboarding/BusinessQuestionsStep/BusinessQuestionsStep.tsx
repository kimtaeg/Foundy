import { BusinessQuestion } from "@/components/onboarding/BusinessQuestion";
import { Element } from "@/components/view/Element";
import { type OnboardingStore } from "@/types/onboarding";

export interface BusinessQuestionsStepProps { store: OnboardingStore }

export function BusinessQuestionsStep({ store }: BusinessQuestionsStepProps) {
  return (
    <Element className="panel">
      <Element as="h2" className="section-title">
        조금만 더 알려주세요
      </Element>
      <Element as="p" className="smallmuted">
        업종과 조건에 맞는 신고·절차를 안내하기 위해 필요한 질문이에요.
      </Element>
      <BusinessQuestion
        field="alcohol"
        title="술도 판매하시나요?"
        description="술 판매 여부에 따라 신고 업종이 달라질 수 있어요."
        value={store.alcohol}
      />
      <BusinessQuestion
        field="terrace"
        title="테라스나 가게 앞 공간을 사용하시나요?"
        description="옥외영업 관련 확인이 필요할 수 있어요."
        value={store.terrace}
      />
      <BusinessQuestion
        field="employees"
        title="직원을 고용하시나요?"
        description="근로계약·4대보험 일정에 영향을 줘요."
        value={store.employees}
      />
      <BusinessQuestion
        field="delivery"
        title="배달도 하시나요?"
        description="배달 영업은 포장·위생 관련 확인이 더 필요할 수 있어요."
        value={store.delivery}
      />
      <Element as="label" className="nx-f" style={{ marginTop: 18 }}>
        준비 자금 (선택, 원)
        <Element
          as="input"
          id="fFunds"
          type="number"
          value={store.funds || ""}
        />
      </Element>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 22,
        }}
      >
        <Element as="button" className="nx-btn outline" data-nx="wizback">
          ← 이전
        </Element>
        <Element as="button" className="nx-btn" data-nx="analyze">
          AI 점검 시작 →
        </Element>
      </div>
    </Element>
  );
}
