import { Element } from "@/components/view/Element";

export type OpeningDateDialogProps = { opening: string };

export function OpeningDateDialog({ opening }: OpeningDateDialogProps) {
  return (
    <Element as="form" id="nxDate" className="nx-stack">
      <Element as="label" className="nx-f">
        개업 예정일
        <Element
          as="input"
          type="date"
          id="nxDateVal"
          required
          defaultValue={opening}
        />
      </Element>
      <Element className="nx-note">
        개업일을 바꾸면 외부 조회 없이 체크리스트 날짜만 다시 계산해요.
      </Element>
      <Element as="button" className="nx-btn" type="submit">
        변경하고 다시 계산
      </Element>
    </Element>
  );
}
