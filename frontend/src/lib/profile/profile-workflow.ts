import { EMPTY_STORE, MPF } from "@/data/store";
import { iso, realToday } from "@/lib/date";
import type { ProfileWorkflowDependencies } from "@/types/dependencies";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createProfileWorkflow(context: ProfileWorkflowDependencies) {
  function progressModal(set: any, lines: any): any {
    const MS: any = {
      dates: "체크리스트 날짜 다시 계산 (계산 도구)",
      trademark: "상표 검색 (KIPRIS)",
      building: "건축물대장 조회",
      law: "조문 조회",
      checklist: "개업 체크리스트 다시 구성",
      grants: "지원사업 자격 다시 판정",
      market: "주변 동종 업소 조회 (카카오)",
      costs: "비용 계산",
      lock: "점검 리포트 잠금 (이전 결과는 보관)",
    };
    const steps: any = [...[...set].map((i: any) => MS[i]), "변경 요약 정리"],
      T: any = "변경 내용을 다시 반영하고 있어요";
    const draw: any = (n: any) => {
      if (!context.modalState || context.modalState.title !== T) return;
      context.modalState.content = {
        kind: "analysis-progress",
        steps,
        completed: n,
        changes: lines,
      };
    };
    context.modal(T, {
      kind: "analysis-progress",
      steps,
      completed: 0,
      changes: lines,
    });
    draw(0);
    steps.forEach((_: string, i: number) =>
      context.setTimeout(() => draw(i + 1), 420 * (i + 1)),
    );
  }

  function applyMp(): any {
    const d: any = context.mpDraft(),
      diff: any = context.mpDiff();
    if (!diff.length) {
      context.toast("바꾼 내용이 없어요");
      return;
    }
    const err: any = context.mpValidate(d);
    if (err) {
      context.toast(err);
      return;
    }
    const { set, cardIds } = context.mpImpacts(diff),
      rl: any = context.resetList(cardIds),
      toDecided: any = diff.some(
        (x: any) => x.k === "location" && x.to === "decided",
      );
    const lines: any = diff.map(
      (x: any) =>
        MPF[x.k][0] +
        ": " +
        context.fmtMp(x.k, x.from) +
        " → " +
        context.fmtMp(x.k, x.to),
    );
    rl.forEach((r: any) =>
      lines.push(r.short + " 카드 선택 초기화 (다시 결정 대기)"),
    );
    cardIds.forEach((id: any) => {
      delete context.RS[id];
    });
    context.NEXTLOG = context.NEXTLOG.filter((n: any) => !cardIds.has(n.cid));
    diff.forEach((x: any) => {
      if (x.k === "location") context.S.location = x.to;
      else if (x.k === "birth") context.S.birth = context.num(x.to) || null;
      else if (x.k === "funds")
        context.S.funds =
          x.to == null || String(x.to).trim() === "" ? null : context.num(x.to);
      else if (x.k === "area")
        context.S.area = x.to == null || String(x.to).trim() === "" ? null : context.num(x.to) || null;
      else if (x.k === "alcohol" || x.k === "terrace" || x.k === "employees" || x.k === "delivery")
        context.S[x.k] = !!x.to;
      else context.S[x.k] = String(x.to == null ? "" : x.to).trim();
    });
    context.S.mainManual = cardIds.has("r-01") ? null : context.S.mainManual;
    context.saveS();
    context.put("rs", context.RS);
    context.put("nextlog", context.NEXTLOG);
    context.syncLinks();
    context.recalc();
    context.CAL.y = null;
    context.CHGLOG.unshift({
      id: "chg-" + Date.now(),
      ts: iso(realToday()),
      lines,
    });
    context.CHGLOG = context.CHGLOG.slice(0, 10);
    context.put("chglog", context.CHGLOG);
    context.MP = null;
    if (toDecided) {
      context.W = { step: 3, path: "decided", done: [], timers: [] };
      context.runAnalysis();
      context.goto("register");
      context.toast("주소를 확정했어요 · 점검을 시작합니다");
      return;
    }
    progressModal(set, lines);
    context.toast("가게 정보를 저장했어요");
  }

  function wipeStore(): any {
    context.cancelPending();
    context.S = { ...EMPTY_STORE };
    context.RS = {};
    context.X = {};
    context.CANDX = [];
    context.NEXTLOG = [];
    context.CHGLOG = [];
    context.AUTO = {};
    context.put("autochk", context.AUTO);
    context.PRICE = "";
    context.put("myprice", "");
    context.tasks.forEach((t: any) => {
      t.done = false;
    });
    context.saveS();
    context.put("rs", context.RS);
    context.put("xdone", context.X);
    context.put("candx", context.CANDX);
    context.put("nextlog", context.NEXTLOG);
    context.put("chglog", context.CHGLOG);
    context.put("tasksdone", {});
    context.MP = null;
    context.closeModal();
    context.W = { step: "choose", path: null, done: [], timers: [] };
    context.goto("register");
    context.toast("가게 정보를 지웠어요 · 처음부터 다시 설정해 주세요");
  }
  return { progressModal, applyMp, wipeStore };
}
