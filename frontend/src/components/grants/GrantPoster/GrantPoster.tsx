import { GrantPosterArtwork } from "@/components/grants/GrantPosterArtwork";
import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantPosterProps {
  grant: Grant;
  deadline: string;
  big?: boolean;
}

export function GrantPoster({
  grant,
  deadline,
  big = false,
}: GrantPosterProps) {
  return (
    <Element
      className={`nx-poster ${big ? "big" : ""}`}
      style={{
        background: `linear-gradient(145deg,${grant.hue[0]},${grant.hue[1]})`,
      }}
    >
      <GrantPosterArtwork />
      <Element className="nx-pk">
        {grant.cat} · {grant.region}
      </Element>
      <Element className="nx-pt">
        {grant.title.replace(" (예시 공고)", "")}
      </Element>
      <Element className="nx-pa">{grant.amount}</Element>
      <Element className="nx-po">{grant.org}</Element>
      <Element className="nx-pd">{deadline}</Element>
      <Element className="nx-pmark">자동 생성 포스터</Element>
    </Element>
  );
}
