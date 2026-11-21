import { MetricCard } from "@/components/common/MetricCard";
import { Element } from "@/components/view/Element";
import type { ManagedDocsData } from "@/types/documents";

export interface DocsProgressSummaryProps {
  data: ManagedDocsData;
}

/** 서류 준비 현황. 체크리스트 완료가 아니라 서류 하나하나의 상태로 센다. 해당 없음은 분모에서 뺀다. */
export function DocsProgressSummary({ data }: DocsProgressSummaryProps) {
  const percent = data.total ? (data.finished / data.total) * 100 : 0;
  return (
    <>
      <Element className="nx-banner">
        <div>
          <Element className="nx-kicker">서류 준비 현황</Element>
          <h3 style={{ margin: "7px 0" }}>
            {data.finished} / {data.total}개 준비 완료
          </h3>
          <Element className="nx-prog">
            <div style={{ width: `${percent}%` }} />
          </Element>
          <Element className="nx-tag" style={{ marginTop: 8 }}>
            발급·취득 완료와 제출 완료를 준비 완료로 세요. 해당 없음 {data.notApplicable}개는 빼고 셌어요.
          </Element>
        </div>
      </Element>
      <Element className="nx-cols4">
        <MetricCard label="남은 서류" value={`${data.remaining}개`} />
        <MetricCard label="발급·취득 필요" value={`${data.toObtain}개`} caption="정부 사이트·교육·검진" />
        <MetricCard label="직접 작성·보관" value={`${data.toWrite}개`} caption="신청서·계약서" />
        <MetricCard label="다시 확인 필요" value={`${data.reviewCount}개`} caption="법령·서식 개정" />
      </Element>
    </>
  );
}
