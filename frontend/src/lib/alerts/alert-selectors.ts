import { addDays, D, dday, diffDays, realToday } from "@/lib/date";
import type { AlertDependencies } from "@/types/dependencies";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createAlertSelectors(context: AlertDependencies) {
  function simToday(): any {
    const o: any = D(context.S.opening);
    return context.SIM === "d7"
      ? addDays(o, -7)
      : context.SIM === "after6m"
        ? addDays(o, 183)
        : realToday();
  }

  function alertsFor(mode: any): any {
    const out: any = [];
    const st: any = simToday();
    if (mode === "now") {
      context.NEXTLOG.forEach((n: any) =>
        out.push({
          id: n.id,
          type: "next",
          title: n.title,
          body: n.body,
          cta: ["카드 열기", "report", n.focus],
        }),
      );
      context.CHGLOG.slice(0, 2).forEach((n: any) =>
        out.push({
          id: n.id,
          type: "change",
          title: "가게 정보를 바꿔 다시 반영했어요",
          body: n.lines.slice(0, 3).join(" · "),
          cta: ["마이페이지 열기", "mypage"],
        }),
      );
    }
    if (mode === "now" && context.S.location === "decided")
      context.pendingDecisions().forEach((c: any) => {
        const r: any = c.options.find((o: any) => c.rec && o.id === c.rec.id);
        out.push({
          id: "dec-" + c.id,
          type: "decision",
          title: "결정 대기 · " + c.title,
          body: r ? "추천: " + r.label : "선택지를 비교해 하나를 정하세요.",
          cta: ["카드 열기", "report", c.id],
        });
      });
    if (mode === "now" && context.S.location === "undecided")
      out.push({
        id: "loc-1",
        type: "decision",
        title: "결정 대기 · 자리(상권) 정하기",
        body: "후보 상권을 비교하고 “여기로 정하기”를 눌러 주소를 입력하세요.",
        cta: ["상권 분석 열기", "sites"],
      });
    if (mode === "now") {
      out.push({
        id: "gr-new",
        type: "grant",
        title: "새 지원사업 공고 · 청년 소상공인 점포 임차 지원",
        body: "신청 가능성 높음 · 마감 2027-02-14 (예시 공고)",
        cta: ["지원사업 열기", "grants"],
        ex: true,
      });
      out.push({
        id: "gr-dl",
        type: "deadline",
        title: "마감 임박 · 창업 기초 교육 과정",
        body: "마감 2026-12-20 " + dday("2026-12-20") + " (예시 공고)",
        cta: ["지원사업 열기", "grants"],
        ex: true,
      });
      out.push({
        id: "chg-now",
        type: "change",
        title: "주변 카페 1곳 개업 · 반경 300m 54 → 55곳",
        body: "다시 조회로 감지된 변화 (예시)",
        cta: ["상권 분석 열기", "sites"],
        ex: true,
      });
    }
    if (mode === "d7") {
      context
        .allTasks()
        .filter((t: any) => !t.done && D(t.due) < st)
        .forEach((t: any) =>
          out.push({
            id: "ov-" + t.id,
            type: "deadline",
            title: "기한이 지났어요 · " + t.task,
            body: "예정일 " + t.due + " · " + t.agency,
            cta: ["체크리스트 열기", "checklist"],
          }),
        );
      context
        .allTasks()
        .filter(
          (t: any) => !t.done && D(t.due) >= st && diffDays(D(t.due), st) <= 14,
        )
        .forEach((t: any) =>
          out.push({
            id: "up-" + t.id,
            type: "deadline",
            title: "곧 해야 해요 · " + t.task,
            body: "예정일 " + t.due + " (D-" + diffDays(D(t.due), st) + ")",
            cta: ["체크리스트 열기", "checklist"],
          }),
        );
      out.push({
        id: "chk-d7",
        type: "deadline",
        title: "개업 7일 전 · 가격표·원산지 표시, 소방·안전 점검",
        body: "개업 전 마지막 점검 항목 (예시)",
        cta: ["체크리스트 열기", "checklist"],
        ex: true,
      });
      out.push({
        id: "chg-d7",
        type: "change",
        title: "식품 관련 규정 개정 시행 예정 · 내 가게 해당 여부 확인",
        body: "조문 번호와 시행일은 실제 조회 후 표시돼요 (예시)",
        cta: ["점검 리포트 열기", "report"],
        ex: true,
      });
    }
    if (mode === "after6m") {
      out.push({
        id: "vat",
        type: "deadline",
        title: "부가가치세 신고 시기가 다가와요",
        body: "정확한 기한은 국세청 안내로 확인하세요 (예시)",
        cta: ["체크리스트 열기", "checklist"],
        ex: true,
      });
      out.push({
        id: "edu",
        type: "deadline",
        title: "위생교육·점검 갱신 일정 확인",
        body: "갱신 주기는 관할 기관 안내 확인 필요 (예시)",
        cta: ["체크리스트 열기", "checklist"],
        ex: true,
      });
      out.push({
        id: "chg-6m",
        type: "change",
        title: "반경 300m 신규 카페 2곳 개업, 1곳 폐업",
        body: "월 1회 상권 요약 (예시)",
        cta: ["상권 분석 열기", "sites"],
        ex: true,
      });
      out.push({
        id: "gr-6m",
        type: "grant",
        title: "새 지원사업 · 개업 1년 이내 소상공인 대상",
        body: "신청 가능성은 공고문 조건 대조 후 표시돼요 (예시)",
        cta: ["지원사업 열기", "grants"],
        ex: true,
      });
    }
    return out;
  }
  return { simToday, alertsFor };
}
