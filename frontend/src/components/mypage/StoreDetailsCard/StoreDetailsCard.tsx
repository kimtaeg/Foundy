import { ProfileField } from "@/components/mypage/ProfileField";
import { Element } from "@/components/view/Element";
import { type FieldDefinitions, type StoreDraft } from "@/types/profile";

export interface StoreDetailsCardProps {
  draft: StoreDraft;
  fields: FieldDefinitions;
  impacts: Record<string, string>;
  regions: string[];
}

export function StoreDetailsCard({
  draft,
  fields,
  impacts,
  regions,
}: StoreDetailsCardProps) {
  const decided = draft.location === "decided";
  const options =
    regions.includes(draft.region) || !draft.region
      ? regions
      : [draft.region, ...regions];
  const hints = (key: keyof StoreDraft) =>
    fields[key][1].map((id) => impacts[id]);
  return (
    <Element as="section" className="nx-card">
      <h3>가게 정보</h3>
      <Element className="nx-form">
        <ProfileField
          label={`가게 이름${decided ? " *" : ""}`}
          hints={hints("name")}
        >
          <Element as="input" data-mp="name" value={draft.name} />
        </ProfileField>
        <ProfileField label="업종" hints={hints("type")}>
          <Element as="select" data-mp="type" value={draft.type}>
            <option>카페</option>
            <option>음식점</option>
          </Element>
        </ProfileField>
        {decided ? (
          <>
            <ProfileField label="가게 주소 *" hints={hints("address")} full>
              <Element
                as="input"
                data-mp="address"
                value={draft.address}
                placeholder="예: 서울 성동구 성수이로 00"
              />
            </ProfileField>
            <ProfileField label="층·호" hints={hints("detail")}>
              <Element as="input" data-mp="detail" value={draft.detail} />
            </ProfileField>
          </>
        ) : (
          <ProfileField label="관심 지역" hints={hints("region")} full>
            <Element as="select" data-mp="region" value={draft.region}>
              {options.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </Element>
          </ProfileField>
        )}
        <ProfileField label="개업 예정일 *" hints={hints("opening")}>
          <Element
            as="input"
            data-mp="opening"
            type="date"
            value={draft.opening}
          />
        </ProfileField>
        <ProfileField label="출생 연도" hints={hints("birth")}>
          <Element
            as="input"
            data-mp="birth"
            type="number"
            value={draft.birth}
          />
        </ProfileField>
      </Element>
    </Element>
  );
}
