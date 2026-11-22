import type { AccountProfile } from "@/types/profile";
import type { BrowserStorage } from "@/types/storage";

interface AuthActionContext {
  logout(): void;
  toast(message: string): void;
  profile(): AccountProfile;
  put(key: string, value: unknown): void;
  LS: BrowserStorage;
  UID: string | null;
}

export function createAuthActions(context: AuthActionContext) {
  function saveAccountName(name: string) {
    const profile = { ...context.profile(), name };
    context.put("profile", profile);
    context.LS.set("foundy-session", JSON.stringify({ uid: context.UID, name, provider: profile.provider }));
    context.toast("이름을 저장했어요");
  }
  return {
    actions: { logout: () => { context.logout(); return true; } },
    saveAccountName,
  };
}
