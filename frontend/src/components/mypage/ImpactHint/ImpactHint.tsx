import { Element } from "@/components/view/Element";

export interface ImpactHintProps { labels: string[] }

export function ImpactHint({ labels }: ImpactHintProps) {
  return (
    <Element as="small" className="nx-hint">
      바뀌면 → {labels.join(" · ")}
    </Element>
  );
}
