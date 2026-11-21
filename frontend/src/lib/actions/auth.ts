import { PROV } from "@/lib/format-provider";
import { type ActionHandlers } from "@/types/actions";
import { type DialogContent } from "@/types/dialog";
import { type AccountProfile } from "@/types/profile";
import { type BrowserStorage } from "@/types/storage";

interface AuthActionContext {
  modal(title: string, content: DialogContent): void;
  setTimeout(callback: () => void, delay: number): unknown;
  $(id: string): HTMLElement | null;
  login(userId: string, name: string, provider: string): void;
  logout(): void;
  toast(message: string): void;
  profile(): AccountProfile;
  put(key: string, value: unknown): void;
  LS: BrowserStorage;
  UID: string | null;
}

/** Commands emitted by auth views; view layout is deliberately absent. */
export function createAuthActions(context: AuthActionContext): ActionHandlers {
  return {
    social: (button) => {
      const provider = button.dataset.p ?? "";
      const providerLabel: string | undefined = PROV[provider];
      if (!providerLabel) return;
      context.modal(`${providerLabel} 계정으로 계속하기`, {
        kind: "social-sign-in",
        provider,
        providerLabel,
      });
      context.setTimeout(() => context.$("socialName")?.focus(), 50);
      return true;
    },
    demologin: () => {
      context.login("demo", "이서연", "demo");
      return true;
    },
    logout: () => {
      context.logout();
      return true;
    },
    unamesave: () => {
      const input = context.$("uname");
      const name = input instanceof HTMLInputElement ? input.value.trim() : "";
      if (!name) {
        context.toast("이름을 입력해 주세요");
        return;
      }
      const profile = context.profile();
      profile.name = name;
      context.put("profile", profile);
      context.LS.set(
        "foundy-session",
        JSON.stringify({
          uid: context.UID,
          name,
          provider: profile.provider,
        }),
      );
      context.toast("이름을 저장했어요");
      return true;
    },
  };
}
