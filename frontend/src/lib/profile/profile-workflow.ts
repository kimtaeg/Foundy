import { EMPTY_STORE, MPF } from "@/data/store";
import { iso, realToday } from "@/lib/date";
import { createInitialChatState } from "@/lib/chat/chat-state";
import type { ProfileWorkflowDependencies } from "@/types/dependencies";
import type { StoreDraft } from "@/types/profile";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createProfileWorkflow(context: ProfileWorkflowDependencies) {
  function applyMp(d: StoreDraft): boolean {
    const diff = context.mpDiff(d);
    if (!diff.length) {
      context.toast("바꾼 내용이 없어요");
      return false;
    }
    const err: any = context.mpValidate(d);
    if (err) {
      context.toast(err);
      return false;
    }
    const { cardIds } = context.mpImpacts(diff),
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
      else if (x.k === "area") context.S.area = context.num(x.to) > 0 ? context.num(x.to) : null;
      else if (x.k === "funds")
        context.S.funds =
          x.to == null || String(x.to).trim() === "" ? null : context.num(x.to);
      else if (x.k === "alcohol" || x.k === "terrace" || x.k === "employees")
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
    if (toDecided) {
      context.W = { step: 3, path: "decided", done: [], timers: [] };
      context.runAnalysis();
      context.goto("register");
      context.toast("주소를 확정했어요 · 점검을 시작합니다");
    }
    return true;
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
    context.CH = createInitialChatState();
    context.closeModal();
    context.W = { step: "choose", path: null, done: [], timers: [] };
    context.goto("register");
    context.toast("가게 정보를 지웠어요 · 처음부터 다시 설정해 주세요");
  }
  return { applyMp, wipeStore };
}
