import { X_DEFS } from "@/data/checklist";
import { contactOfAgency } from "@/data/contacts";
import { addDays, D, dday, iso, realToday } from "@/lib/date";
import type { FollowUpDependencies } from "@/types/dependencies";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createFollowUp(context: FollowUpDependencies) {
  function nextSteps(excl: any): any {
    const cards: any = context.buildCards(),
      out: any = [];
    if (context.S.location === "undecided") {
      out.push({
        t: "후보 상권 중 한 곳 고르기",
        s: "경쟁이 낮은 곳부터 비교해요",
        go: ["sites", ""],
        cta: "상권 보기",
      });
      return out;
    }
    const st: any = context.RS[excl] || {},
      added: any = st.added || [];
    added.forEach((id: any) => {
      const d: any = X_DEFS[id];
      if (d)
        out.push({
          k: "new",
          t: d.task,
          s:
            "이 선택으로 새로 생긴 할 일 · 예정 " +
            iso(addDays(D(context.S.opening), d.off))
              .slice(5)
              .replace("-", "."),
          go: ["checklist", ""],
          cta: "체크리스트 열기",
        });
    });
    context
      .pendingDecisions()
      .filter((c: any) => c.id !== excl)
      .sort(
        (a: any, b: any) =>
          Number(b.base === "high") - Number(a.base === "high"),
      )
      .forEach((c: any) => {
        const r: any = c.options.find((o: any) => c.rec && o.id === c.rec.id);
        out.push({
          k: "decide",
          t: "결정하기 · " + c.title,
          s: r ? "추천: " + r.label : "선택지를 비교해 하나를 고르세요",
          go: ["report", c.id],
          cta: "카드 열기",
        });
      });
    cards
      .filter((c: any) => c.id !== excl)
      .forEach((c: any) => {
        const a: any = context.curAction(c);
        if (!a) return;
        if (c.options.length && !(context.RS[c.id] && context.RS[c.id].chosen))
          return;
        if (
          ((context.RS[c.id] && context.RS[c.id].action) || "pending") !==
          "pending"
        )
          return;
        out.push({
          k: "do",
          t: a.text + " (" + a.min + "분)",
          s: "결과 카드 · " + context.cardShort(c),
          go: ["report", c.id],
          cta: "카드 열기",
        });
      });
    context
      .allTasks()
      .filter((t: any) => !t.done && !added.includes(t.id))
      .slice(0, 2)
      .forEach((t: any) => {
        const k: any = contactOfAgency(t.agency);
        out.push({
          k: "task",
          t: t.task,
          s:
            "체크리스트 · 예정 " +
            t.due.slice(5).replace("-", ".") +
            " (" +
            dday(t.due) +
            ") · " +
            t.agency +
            (k ? " ☎ " + k.phone + (k.ex ? " (예시)" : "") : ""),
          go: ["checklist", ""],
          cta: "체크리스트 열기",
        });
      });
    return out.slice(0, 5);
  }

  function logNext(id: any, status: any): any {
    context.NEXTLOG = context.NEXTLOG.filter((x: any) => x.cid !== id);
    if (status !== "pending") {
      const c: any = context.buildCards().find((x: any) => x.id === id);
      if (c) {
        const steps: any = nextSteps(id);
        context.NEXTLOG.unshift({
          id: "next-" + id + "-" + status,
          cid: id,
          ts: iso(realToday()),
          title:
            status === "done"
              ? "“" +
                context.cardShort(c) +
                "” 완료 · 다음 할 일 " +
                steps.length +
                "개"
              : "“" +
                context.cardShort(c) +
                "” 문의함 · 먼저 할 일 " +
                steps.length +
                "개",
          body:
            steps
              .slice(0, 3)
              .map((s: any) => s.t)
              .join(" → ") || "모든 점검을 마쳤어요",
          focus: id,
        });
        context.NEXTLOG = context.NEXTLOG.slice(0, 6);
      }
    }
    context.put("nextlog", context.NEXTLOG);
  }

  function showNext(id: any): any {
    context.setTimeout(() => {
      const el: any = context.document.querySelector(
        "#result-" + id + " .nx-next",
      );
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }
  return { nextSteps, logNext, showNext };
}
