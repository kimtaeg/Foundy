import { ProfileBooleanField } from "@/components/mypage/ProfileBooleanField";
import { ProfileField } from "@/components/mypage/ProfileField";
import { Element } from "@/components/view/Element";
import { type FieldDefinitions, type StoreDraft } from "@/types/profile";

export interface BusinessConditionsCardProps {
  draft: StoreDraft;
  fields: FieldDefinitions;
  impacts: Record<string, string>;
}

export function BusinessConditionsCard({
  draft,
  fields,
  impacts,
}: BusinessConditionsCardProps) {
  const hints = (key: keyof StoreDraft) =>
    fields[key][1].map((id) => impacts[id]);
  return (
    <Element as="section" className="nx-card">
      <h3>영업 조건</h3>
      <Element className="nx-form">
        <ProfileBooleanField
          field="alcohol"
          label="술도 판매하나요?"
          value={draft.alcohol}
          hints={hints("alcohol")}
        />
        <ProfileBooleanField
          field="terrace"
          label="테라스·가게 앞 공간을 쓰나요?"
          value={draft.terrace}
          hints={hints("terrace")}
        />
        <ProfileBooleanField
          field="employees"
          label="직원을 고용하나요?"
          value={draft.employees}
          hints={hints("employees")}
        />
        <ProfileField label="준비 자금 (원)" hints={hints("funds")}>
          <Element
            as="input"
            data-mp="funds"
            type="number"
            value={draft.funds}
          />
        </ProfileField>
      </Element>
    </Element>
  );
}
