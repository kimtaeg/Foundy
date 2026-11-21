import { Element } from "@/components/view/Element";

export type CalendarLegendProps = { colors: Record<string, string> };

export function CalendarLegend({ colors }: CalendarLegendProps) {
  return (
    <Element className="nx-legend">
      {Object.entries(colors).map(([category, color]) => (
        <Element as="span" className="nx-leg" key={category}>
          <i style={{ background: color }} />
          {category}
        </Element>
      ))}
    </Element>
  );
}
