import { profileFieldLabels } from "@/lib/profile/editable-fields";
import type { BooleanProfileField } from "@/types/profile";

export interface ProfileBooleanFieldProps {
  field: BooleanProfileField;
  value: boolean | null;
  onChange?(answer: boolean): void;
}

export function ProfileBooleanField({ field, value, onChange }: ProfileBooleanFieldProps) {
  const label = profileFieldLabels[field];
  return (
    <div role="group" aria-label={label} className="relative inline-grid w-fit grid-cols-2 rounded-lg bg-neutral-100 p-1">
      <span aria-hidden="true" className={`pointer-events-none absolute inset-1 ${value === null ? "invisible" : ""}`}>
        <span className={`block h-full w-1/2 rounded-md transition-[translate,background-color] duration-200 ease-out motion-reduce:transition-none ${value ? "translate-x-0 bg-foundy-primary" : "translate-x-full bg-white"}`} />
      </span>
      {[true, false].map((answer) => {
        const text = answer ? "네" : "아니요";
        const selected = answer === value;
        const color = selected ? (answer ? "text-white" : "text-neutral-900") : "text-neutral-600";
        return (
          <button key={text} type="button" aria-pressed={selected}
            data-nx={onChange ? undefined : "mptoggle"} data-field={field} data-answer={String(answer)}
            onClick={onChange && (() => { if (!selected) onChange(answer); })}
            className={`relative grid min-h-9 min-w-12 cursor-pointer place-items-center rounded-md border-0 bg-transparent px-2 text-sm font-medium leading-5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-foundy-primary motion-reduce:transition-none ${color}`}>
            {text}
          </button>
        );
      })}
    </div>
  );
}
