import { IMPCARDS, MPF } from "@/data/store";
import type { ProfileDependencies } from "@/types/dependencies";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createProfileSelectors(context: ProfileDependencies) {
  const mpBase: any = () => {
    const e: any = context.eff();
    return {
      name: e.name,
      type: context.S.type,
      address: context.S.address,
      detail: context.S.detail,
      region: context.S.region,
      opening: context.S.opening,
      birth: context.S.birth || "",
      alcohol: e.alcohol,
      terrace: context.S.terrace,
      employees: context.S.employees,
      funds: context.S.funds ?? "",
      location: context.S.location,
    };
  };

  function mpDiff(d = mpBase()): any {
    const b: any = mpBase(),
      keys: any = [
        "name",
        "type",
        "opening",
        "birth",
        "alcohol",
        "terrace",
        "employees",
        "funds",
      ];
    if (d.location === "decided") keys.push("address", "detail");
    else keys.push("region");
    const out: any = [];
    keys.forEach((k: any) => {
      if (context.normMp(k, b[k]) !== context.normMp(k, d[k]))
        out.push({ k, from: b[k], to: d[k] });
    });
    if (d.location !== b.location)
      out.push({ k: "location", from: b.location, to: d.location });
    return out;
  }

  function mpImpacts(diff: any): any {
    const set: any = new Set(),
      cardIds: any = new Set();
    diff.forEach((x: any) => {
      if (x.k === "location") {
        if (x.to === "decided") {
          ["building", "law", "checklist", "market", "trademark"].forEach(
            (i: any) => set.add(i),
          );
          ["r-01", "r-02", "r-03", "r-04"].forEach((i: any) => cardIds.add(i));
        } else {
          set.add("market");
          set.add("lock");
        }
      } else MPF[x.k][1].forEach((i: any) => set.add(i));
    });
    set.forEach((i: any) =>
      (IMPCARDS[i] || []).forEach((c: any) => cardIds.add(c)),
    );
    return { set, cardIds };
  }

  function resetList(cardIds: any): any {
    const cards: any = context.buildCards(),
      out: any = [];
    cardIds.forEach((id: any) => {
      const st: any = context.RS[id];
      if (!st || !(st.chosen || (st.action && st.action !== "pending"))) return;
      const c: any = cards.find((x: any) => x.id === id);
      if (!c) return;
      const o: any = c.options.find((x: any) => x.id === st.chosen);
      out.push({ id, short: context.cardShort(c), opt: o ? o.label : "" });
    });
    return out;
  }

  function mpValidate(d: any): any {
    if (d.location === "decided" && !String(d.address || "").trim())
      return "주소를 입력해 주세요";
    if (d.location === "decided" && !String(d.name || "").trim())
      return "가게 이름을 입력해 주세요";
    if (!d.opening) return "개업 예정일을 입력해 주세요";
    return null;
  }
  return { mpBase, mpDiff, mpImpacts, resetList, mpValidate };
}
