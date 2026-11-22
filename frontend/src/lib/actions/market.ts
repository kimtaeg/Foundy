import { AREAS } from "@/data/market";
import { type ActionHandlers } from "@/types/actions";
import { type DialogContent } from "@/types/dialog";
import { type MarketSelection } from "@/types/market";
import { type Store } from "@/types/store";

interface MarketActionContext {
  MAP: MarketSelection;
  S: Store;
  saveS: () => void;
  toast: (message: string) => void;
  CANDX: string[];
  put: (key: string, value: unknown) => void;
  modal: (title: string, content: DialogContent) => void;
}

/** Commands emitted by market views; view layout is deliberately absent. */
export function createMarketActions(
  context: MarketActionContext,
): ActionHandlers {
  return {
    mk: (button) => {
      context.MAP.sel = button.dataset.id ?? "";
      return true;
    },
    mcat: (button) => {
      context.MAP.cat = button.dataset.v ?? "";
      return true;
    },
    mrad: (button) => {
      context.MAP.r = Number(button.dataset.r);
      return true;
    },
    setmain: (button) => {
      context.S.mainManual = button.dataset.k ?? null;
      context.saveS();
      context.toast(
        "기준 자리를 " +
          button.dataset.k +
          "로 바꿨어요 · 점검 리포트 재분석이 필요해요 (시안)",
      );
      return true;
    },
    delcand: (button) => {
      context.CANDX = context.CANDX.filter(
        (address) => address !== button.dataset.addr,
      );
      context.put("candx", context.CANDX);
      return true;
    },
    pick: (button) => {
      const area: { id: string; name: string } | undefined = AREAS.find(
        (item: { id: string }) => item.id === button.dataset.id,
      );
      if (!area) return;
      context.modal("여기로 정하기 · " + area.name, {
        kind: "location-pick",
        areaId: area.id,
      });
      return true;
    },
  };
}
