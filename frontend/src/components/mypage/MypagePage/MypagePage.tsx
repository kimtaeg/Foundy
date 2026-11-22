"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MypageView } from "@/components/mypage/MypageView";
import { OnboardingPage } from "@/components/onboarding/OnboardingPage";
import { useProfile } from "@/hooks/useProfile";
import { useFoundy } from "@/hooks/useFoundy";
import { isBooleanProfileField, isEditableProfileField } from "@/lib/profile/editable-fields";
import { refreshAfterProfileSave, saveServerProfileField } from "@/lib/profile/save-server-profile";
import type { ViewEventHandler } from "@/types/events";
import type { EditableProfileField, ProfileFieldEdit } from "@/types/profile";

export function MypagePage() {
  const { onEvent, api, apiActive, apiError, refreshApi, updateApi } = useFoundy();
  const [edit, setEdit] = useState<ProfileFieldEdit>();
  const [pending, setPending] = useState<{ field: EditableProfileField; value: string | boolean }>();
  const data = useProfile(pending);
  const busy = useRef(false);

  async function save(field: EditableProfileField, value: string | boolean) {
    if (busy.current || (field !== "accountName" && !api?.bundle.store)) return;
    busy.current = true;
    const failedEdit = edit?.field === field && typeof value === "string" ? { ...edit, inputValue: value } : undefined;
    setPending({ field, value });
    setEdit(undefined);
    try {
      const result = await saveServerProfileField(api?.bundle.store, field, value);
      const sync = refreshAfterProfileSave(result, refreshApi, updateApi);
      toast.success("정보를 저장했어요");
      void sync.catch(error => {
        toast.error(error instanceof Error ? error.message : "저장 결과를 확인해 주세요.");
      });
    } catch (error) {
      setEdit(failedEdit);
      toast.error(error instanceof Error ? error.message : "저장 결과를 확인해 주세요.");
    } finally {
      setPending(undefined);
      busy.current = false;
    }
  }

  const handleEvent: ViewEventHandler = (type, event) => {
    if (!apiActive) return onEvent(type, event);
    const target = event.target as HTMLElement;
    if (type === "submit" && target instanceof HTMLFormElement && target.hasAttribute("data-profile-field")) {
      event.preventDefault();
      if (edit && edit.field === target.dataset.profileField) {
        void save(edit.field, String(new FormData(target).get("value") ?? "").trim());
      }
      return;
    }
    const button = type === "click" ? target.closest<HTMLElement>("[data-nx]") : null;
    const action = button?.dataset.nx;
    if (!action?.startsWith("mp")) return onEvent(type, event);
    if (!api || !data || !button) return;
    if (busy.current) {
      toast.info("이전 변경 사항을 반영하고 있어요.");
      return;
    }
    const field = button.dataset.field;
    if (action === "mpcancel") setEdit(undefined);
    if (action === "mpedit" && isEditableProfileField(field) && !isBooleanProfileField(field)) {
      const value = String(field === "accountName" ? data.profile.name : data.draft[field]);
      const choices = ["카페", "음식점"];
      setEdit({
        field, value,
        required: ["accountName", "name", "opening", "address", "type"].includes(field),
        options: field === "type" ? [...new Set([...choices, value])] : undefined,
      });
    }
    if (action === "mptoggle" && isBooleanProfileField(field)) {
      const answer = button.dataset.answer === "true";
      if (data.answers?.[field] !== answer) void save(field, answer);
    }
  };
  return <MypageView data={data ? (apiActive ? { ...data, edit } : data) : undefined}
    setup={apiActive && data && !data.onboarded ? <OnboardingPage embedded /> : undefined}
    error={apiActive ? apiError : null} loading={!data && !apiError} onRetry={() => void refreshApi()} onEvent={handleEvent} />;
}
