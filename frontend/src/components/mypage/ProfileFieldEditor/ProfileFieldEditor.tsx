"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { profileFieldLabels } from "@/lib/profile/editable-fields";
import type { ProfileFieldEdit } from "@/types/profile";

const inputClass = "block min-h-11 w-full min-w-0 rounded-lg border border-solid border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-foundy-primary focus-visible:outline-foundy-primary";
export interface ProfileFieldEditorProps { edit: ProfileFieldEdit }

export function ProfileFieldEditor({ edit }: ProfileFieldEditorProps) {
  const { field, required, options } = edit;
  const [value, setValue] = useState(edit.inputValue ?? edit.value);
  const form = useRef<HTMLFormElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    form.current?.querySelector<HTMLElement>('input:not([tabindex="-1"]), select, button[aria-haspopup="dialog"]')?.focus({ preventScroll: true });
  }, []);
  const label = profileFieldLabels[field];
  const number = field === "funds" || field === "birth" || field === "area";
  const dirty = number && value !== "" && edit.value !== ""
    ? Number(value) !== Number(edit.value)
    : value.trim() !== edit.value.trim();
  const canSave = dirty && (!required || !!value.trim());
  return (
    <form ref={form} data-profile-field={field} aria-label={label + " 수정"}
      className="flex min-w-0 items-center gap-1 sm:gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          cancel.current?.click();
        }
      }}>
      <div className="min-w-0 flex-1">
        {field === "opening" ? (
          <DatePickerField id="profileOpening" name="value" label={label} value={value} onValueChange={setValue} required={required} />
        ) : options ? (
          <select name="value" aria-label={label} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>
            {!value && !options.includes("") && <option value="">선택하세요</option>}
            {options.map((option) => <option key={option}>{option}</option>)}
          </select>
        ) : (
          <div className="relative">
            <input name="value" aria-label={label} type={number ? "number" : "text"}
              value={value} required={required} maxLength={field === "accountName" ? 12 : undefined}
              onChange={(event) => setValue(event.target.value)} className={`${inputClass} ${field === "funds" || field === "area" ? "pr-10" : ""}`} />
            {(field === "funds" || field === "area") && <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-600">{field === "area" ? "㎡" : "원"}</span>}
          </div>
        )}
      </div>
      <button ref={cancel} type="button" data-nx="mpcancel" aria-label={label + " 수정 취소"} title="취소"
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-neutral-600 hover:bg-neutral-100 focus-visible:outline-foundy-primary">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <button type="submit" disabled={!canSave}
        className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-foundy-primary-ink hover:bg-foundy-primary/5 focus-visible:outline-foundy-primary disabled:cursor-default disabled:text-neutral-500">
        저장
      </button>
    </form>
  );
}
