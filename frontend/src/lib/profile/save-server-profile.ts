import { apiFetch } from "@/lib/api/client";
import { createStoreApi, loadSession, rememberApiIdentity } from "@/lib/api/foundy-api";
import { followRun } from "@/lib/api/run-stream";
import { buildStorePatch, formFromStore } from "@/lib/api/store-update";
import type { ApiAlert, ApiChecklistDates, ApiIdentity, ApiResource, ApiStore } from "@/lib/api/types";
import type { FoundyContextValue } from "@/types/app";
import type { EditableProfileField } from "@/types/profile";

type ProfileSave = {
  token: string;
  keys: ApiResource[];
  runId?: string;
  identity?: ApiIdentity;
  store?: ApiStore;
  identityStore?: boolean;
  alert?: ApiAlert;
  removedAlertIds?: string[];
  alertsChangedByReset?: boolean;
  checklistDates?: ApiChecklistDates;
};

const analysisResources: ApiResource[] = ["report", "dashboard", "checklist", "documents", "alerts"];

export async function saveServerProfileField(store: ApiStore | undefined, field: EditableProfileField, value: string | boolean): Promise<ProfileSave> {
  const session = loadSession();
  if (!session || (store && session.storeId !== store.store_id)) throw new Error("로그인 정보를 다시 확인해 주세요.");
  if (field === "accountName") {
    const identity = await apiFetch<ApiIdentity>("/api/me", { method: "PATCH", token: session.token, body: { name: String(value).trim() } });
    rememberApiIdentity(session.token, identity);
    return { token: session.token, keys: ["me"], identity };
  }
  if (field === "region") throw new Error("관심 지역을 수정할 수 없어요.");

  let patch: Record<string, unknown>;
  if (store) {
    const base = formFromStore(store);
    patch = buildStorePatch(base, { ...base, [field]: value });
  } else if (field === "opening") {
    patch = { opening_date: value };
  } else {
    throw new Error("가게 정보를 다시 불러와 주세요.");
  }
  if (!Object.keys(patch).length) return { token: session.token, keys: [] };

  const result = await createStoreApi(session).patchStore(patch);
  const keys: ApiResource[] = ["store", "alerts"];
  const identityStore = field === "name" || field === "opening";
  if (identityStore) keys.push("me");
  if (identityStore || ["type", "address", "detail"].includes(field)) keys.push("dashboard");
  if (field === "opening" || result.recomputed?.length || result.reset_items.length || result.run_id) {
    keys.push(...analysisResources);
  }
  return {
    token: session.token,
    keys: [...new Set(keys)],
    store: result.store,
    identityStore,
    alert: result.alert,
    removedAlertIds: result.removed_alert_ids,
    alertsChangedByReset: result.reset_items.length > 0,
    checklistDates: result.checklist_dates,
    runId: result.run_id ?? undefined,
  };
}

export async function refreshAfterProfileSave(
  result: ProfileSave,
  refresh: FoundyContextValue["refreshApi"],
  update?: FoundyContextValue["updateApi"],
) {
  const { token, runId } = result;
  if (loadSession()?.token !== token) return;
  const keys = new Set(result.keys);
  const { identity, store, alert, checklistDates } = result;
  if (update) {
    if (identity) {
      update("me", () => identity);
      keys.delete("me");
    }
    if (store) {
      update("store", () => store);
      keys.delete("store");
      if (result.identityStore) {
        update("me", value => rememberApiIdentity(token, {
          ...value, store_name: store.name, store_opening: store.opening_date,
        }), true, true);
        keys.delete("me");
      }
    }
    if (alert) {
      const removed = new Set(result.removedAlertIds);
      update("alerts", items => [
        ...(removed.has(alert.alert_id) ? [] : [alert]),
        ...items.filter(item => item.alert_id !== alert.alert_id && !removed.has(item.alert_id)),
      ], true, true);
      if (!result.alertsChangedByReset) keys.delete("alerts");
    }
    if (store && checklistDates) {
      const byId = new Map(checklistDates.items.map(item => [item.item_id, item]));
      update("checklist", checklist => ({
        ...checklist, opening_date: store.opening_date, as_of: checklistDates.as_of,
        groups: checklist.groups.map(group => ({
          ...group,
          items: group.items.map(item => ({ ...item, ...byId.get(item.item_id) })),
        })),
      }), true, true);
      keys.delete("checklist");
    }
  }
  if (!keys.size && !runId) return;
  const reread = keys.size ? refresh([...keys]) : Promise.resolve(null);
  if (!runId) {
    if (await reread) return;
    throw new Error("정보는 저장했지만 새 값을 불러오지 못했어요. 다시 불러와 주세요.");
  }
  try {
    await followRun(runId, token, () => {});
  } catch {
    if (loadSession()?.token !== token) return;
    throw new Error("정보는 저장했지만 재점검을 완료하지 못했어요.");
  }
  if (loadSession()?.token !== token) return;
  if (await refresh(["store", ...analysisResources])) return;
  throw new Error("정보는 저장했지만 새 값을 불러오지 못했어요. 다시 불러와 주세요.");
}
