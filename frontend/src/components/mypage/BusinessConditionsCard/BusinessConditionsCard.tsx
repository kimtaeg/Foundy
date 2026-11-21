import { ProfileBooleanField } from "@/components/mypage/ProfileBooleanField";
import { ProfileField } from "@/components/mypage/ProfileField";
import { Element } from "@/components/view/Element";
import { type FieldDefinitions, type ProfileViewModel, type StoreDraft } from "@/types/profile";

export interface BusinessConditionsCardProps {
  draft: StoreDraft;
  fields: FieldDefinitions;
  impacts: Record<string, string>;
  /** 서버 연결 모드: 미답변(null)을 포함한 예/아니요 값 */
  answered?: ProfileViewModel["answered"];
  /** 카드 선택으로 저장값과 다르게 적용 중인 값 안내 */
  notes?: ProfileViewModel["notes"];
}

type YesNoKey = "alcohol" | "terrace" | "employees" | "delivery";

export function BusinessConditionsCard({
  draft,
  fields,
  impacts,
  answered,
  notes,
}: BusinessConditionsCardProps) {
  const hints = (key: keyof StoreDraft) =>
    fields[key][1].map((id) => impacts[id]);
  const yesNo = (key: YesNoKey) => (answered && key in answered ? (answered[key] ?? null) : draft[key]);
  return (
    <Element as="section" className="nx-card">
      <h3>영업 조건</h3>
      <Element className="nx-form">
        <ProfileBooleanField
          field="alcohol"
          label="술도 판매하나요?"
          value={yesNo("alcohol")}
          hints={hints("alcohol")}
          note={notes?.alcohol}
        />
        <ProfileBooleanField
          field="terrace"
          label="테라스·가게 앞 공간을 쓰나요?"
          value={yesNo("terrace")}
          hints={hints("terrace")}
          note={notes?.terrace}
        />
        <ProfileBooleanField
          field="employees"
          label="직원을 고용하나요?"
          value={yesNo("employees")}
          hints={hints("employees")}
          note={notes?.employees}
        />
        <ProfileBooleanField
          field="delivery"
          label="배달도 하나요?"
          value={yesNo("delivery")}
          hints={hints("delivery")}
          note={notes?.delivery}
        />
        <ProfileField label="영업장 면적 (㎡)" hints={hints("area")}>
          <Element
            as="input"
            data-mp="area"
            type="number"
            min="1"
            step="0.1"
            value={draft.area}
          />
        </ProfileField>
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
