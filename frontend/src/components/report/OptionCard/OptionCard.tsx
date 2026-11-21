import { Element } from "@/components/view/Element";
import { optionMeta } from "@/lib/report/option-meta";
import { type ReportOption } from "@/types/report";

/** 선택지 한 장. 누르면 근거를 보여 주는 확인 창이 열린다. 추천은 배지로만 표시한다. */
export type OptionCardProps = {
  cardId: string;
  option: ReportOption;
  recommended: boolean;
};

export function OptionCard({
  cardId,
  option,
  recommended,
}: OptionCardProps) {
  const meta = optionMeta(option);
  return (
    <Element
      as="button"
      type="button"
      className="w-full cursor-pointer rounded-[16px] border-[1.5px] border-solid border-neutral-200 bg-white p-4 text-left text-[var(--ink)] transition-colors hover:border-foundy-primary focus-visible:outline-2 focus-visible:outline-foundy-primary"
      data-nx="opt"
      data-id={cardId}
      data-o={option.id}
    >
      <span className="flex items-center gap-2">
        <b className="text-[15px] leading-6">{option.label}</b>
        {recommended && (
          <Element as="span" className="nx-badge ok">
            추천
          </Element>
        )}
      </span>
      <Element as="span" className="nx-muted block">
        {option.summary}
        {meta && ` · ${meta}`}
      </Element>
    </Element>
  );
}
