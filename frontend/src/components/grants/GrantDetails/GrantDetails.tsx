import { GrantConditionQuote } from "@/components/grants/GrantConditionQuote";
import { GrantDetailSummary } from "@/components/grants/GrantDetailSummary";
import { GrantPoster } from "@/components/grants/GrantPoster";
import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantDetailsProps {
  grant: Grant;
  deadline: string;
  result: { label: string; tone: string };
}
export function GrantDetails({ grant, deadline, result }: GrantDetailsProps) {
  return (
    <>
      <Element className="nx-gdetail">
        <GrantPoster grant={grant} deadline={deadline} big />
        <GrantDetailSummary grant={grant} result={result} />
      </Element>
      <Element className="nx-seg-title" style={{ marginTop: 14 }}>
        조건별 판정과 공고문 인용
      </Element>
      {grant.checks.map((condition) => (
        <GrantConditionQuote key={condition[0]} condition={condition} />
      ))}
      <Element as="p" className="nx-muted">
        신청 전 주관 기관의 원문 공고를 확인하세요. 마감일이 있는 공고는
        체크리스트·달력에 자동으로 들어가요.
      </Element>
    </>
  );
}
