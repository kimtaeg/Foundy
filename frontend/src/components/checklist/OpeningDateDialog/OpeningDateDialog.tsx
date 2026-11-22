"use client";
import { useContext, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FoundyContext } from "@/providers/FoundyContext";
import { refreshAfterProfileSave, saveServerProfileField } from "@/lib/profile/save-server-profile";
import { dialogActionRow, dialogPrimaryAction, dialogSecondaryAction } from "@/components/feedback/Modal/dialog-styles";
import { DatePickerField } from "@/components/ui/DatePickerField";

export type OpeningDateDialogProps = { opening: string };

export function OpeningDateDialog({ opening }: OpeningDateDialogProps) {
  const app = useContext(FoundyContext);
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!app?.apiActive) return;
    event.preventDefault();
    event.stopPropagation();
    if (!app.api || lock.current) return;
    const value = String(new FormData(event.currentTarget).get("opening") ?? "");
    if (!value || value === opening) return;
    lock.current = true;
    setSaving(true);
    try {
      const run = await saveServerProfileField(app.api.bundle.store, "opening", value);
      app.closeModal();
      await refreshAfterProfileSave(run, app.refreshApi, app.updateApi);
      toast.success("개업 예정일을 반영했어요");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "개업 예정일을 저장하지 못했어요.");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <form id="nxDate" onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="nxDateVal-trigger" className="text-sm font-medium text-neutral-600">개업 예정일</label>
        <DatePickerField name="opening" id="nxDateVal" label="개업 예정일" value={opening} required />
        <p
          id="nxDateDescription"
          className="m-0 text-sm leading-relaxed text-neutral-600"
        >
          개업일에 맞춰 체크리스트의 준비 일정도 함께 변경돼요.
        </p>
      </div>
      <div className={dialogActionRow}>
        <button type="button" data-dialog-dismiss="" className={dialogSecondaryAction}>취소</button>
        <button disabled={saving} type="submit" className={dialogPrimaryAction}>변경하고 다시 계산</button>
      </div>
    </form>
  );
}
