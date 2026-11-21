import { Element } from "@/components/view/Element";

export interface BusinessQuestionProps {
  field: string;
  title: string;
  description: string;
  value: boolean;
}

export function BusinessQuestion({
  field,
  title,
  description,
  value,
}: BusinessQuestionProps) {
  return (
    <Element className="question">
      <strong>{title}</strong>
      <small>{description}</small>
      <Element className="options">
        <Element
          as="button"
          type="button"
          className={`nx-yn ${value ? "on" : ""}`}
          data-nx="yn"
          data-k={field}
          data-v="1"
        >
          네
        </Element>
        <Element
          as="button"
          type="button"
          className={`nx-yn ${!value ? "on" : ""}`}
          data-nx="yn"
          data-k={field}
          data-v="0"
        >
          아니요
        </Element>
      </Element>
    </Element>
  );
}
