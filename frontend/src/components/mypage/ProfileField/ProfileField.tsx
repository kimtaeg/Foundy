"use client";
import { useLayoutEffect, useRef } from "react";
import { ProfileFieldEditor } from "@/components/mypage/ProfileFieldEditor";
import { profileFieldLabels } from "@/lib/profile/editable-fields";
import type { ProfileFieldEdit } from "@/types/profile";

export interface ProfileFieldProps {
  field: ProfileFieldEdit["field"];
  value: string | number | null;
  edit?: ProfileFieldEdit;
}

export function ProfileField({ field, value, edit }: ProfileFieldProps) {
  const label = profileFieldLabels[field];
  const editing = edit?.field === field;
  const pencil = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useLayoutEffect(() => {
    if (wasEditing.current && !editing && document.activeElement === document.body) {
      pencil.current?.focus({ preventScroll: true });
    }
    wasEditing.current = editing;
  }, [editing]);

  return (
    <div className="relative min-w-0 border-0 border-b border-solid border-neutral-100 py-2.5">
      <dt className="m-0 text-sm font-medium leading-5 text-neutral-600">{label}</dt>
      <dd className="m-0 mt-1 min-w-0 text-base font-medium leading-6 text-neutral-900">
        {editing ? <ProfileFieldEditor edit={edit} /> : (
          <>
            <span id={`profile-value-${field}`} className="block break-words pr-12">{value == null || value === "" ? "미입력" : value}</span>
            <button ref={pencil} type="button" data-nx="mpedit" data-field={field}
              aria-label={`${label} 수정`} aria-describedby={`profile-value-${field}`}
              className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg border-0 bg-transparent text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-foundy-primary-ink focus-visible:outline-foundy-primary">
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15.5 5.5 3 3M4 20l4.5-1 12-12a2.12 2.12 0 0 0-3-3l-12 12L4 20Z" />
              </svg>
            </button>
          </>
        )}
      </dd>
    </div>
  );
}
