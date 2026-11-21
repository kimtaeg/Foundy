import { Element } from "@/components/view/Element";

export interface LocationPickDialogProps { areaId: string }

export function LocationPickDialog({ areaId }: LocationPickDialogProps) {
  return (
    <Element as="form" id="nxPick" className="nx-stack" data-area={areaId}>
      <Element as="p" className="nx-muted">
        이 상권에서 알아본 자리의 주소를 입력하면 점검 리포트가 시작돼요.
      </Element>
      <Element as="label" className="nx-f">
        후보 주소 *
        <Element
          as="input"
          id="pickAddr"
          required
          placeholder="예: 서울 성동구 성수이로 00"
        />
      </Element>
      <Element as="label" className="nx-f">
        층<Element as="input" id="pickFloor" value="1층" />
      </Element>
      <Element as="button" className="nx-btn" type="submit">
        주소 확정하고 점검 시작
      </Element>
    </Element>
  );
}
