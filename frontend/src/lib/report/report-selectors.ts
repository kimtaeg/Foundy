import type { ReportDependencies } from "@/types/dependencies";
/** Explicit dependencies keep this feature independent from application wiring. */

export function createReportSelectors(context: ReportDependencies) {
  function eff(): any {
    const e: any = {
      alcohol: context.S.alcohol,
      name: context.S.name,
      main: context.S.mainManual || "A",
      extra: [],
    };
    context.buildCards().forEach((c: any) => {
      const st: any = context.RS[c.id];
      if (!st || !st.chosen) return;
      const o: any = c.options.find((x: any) => x.id === st.chosen);
      if (!o || !o.fx) return;
      const f: any = o.fx;
      if (f.alcohol === false) e.alcohol = false;
      if (f.name) e.name = f.name;
      if (f.main && !context.S.mainManual) e.main = f.main;
      if (f.addTask) e.extra.push(f.addTask);
    });
    return e;
  }

  const ev: any = (c: any) => {
    const st: any = context.RS[c.id];
    if (st && st.chosen) {
      const o: any = c.options.find((x: any) => x.id === st.chosen);
      if (o && o.fx && o.fx.verdict) return o.fx.verdict;
    }
    return c.base;
  };

  const curAction: any = (c: any) => {
    const st: any = context.RS[c.id] || {};
    const o: any = c.options.find((x: any) => x.id === st.chosen);
    return (o && o.action) || c.action;
  };

  const pendingDecisions: any = () =>
    context
      .buildCards()
      .filter(
        (c: any) =>
          c.options.length && !(context.RS[c.id] && context.RS[c.id].chosen),
      );

  return { eff, ev, curAction, pendingDecisions };
}
