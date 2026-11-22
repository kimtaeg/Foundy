import type { InputHTMLAttributes, ReactNode } from "react";

export interface LoginFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  error?: string;
  trailingAction?: ReactNode;
}

export function LoginField({
  id,
  label,
  error,
  trailingAction,
  className = "",
  "aria-describedby": describedBy,
  ...inputProps
}: LoginFieldProps) {
  const errorId = `${id}-error`;
  const description = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-neutral-800">
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={description}
          className={`block h-[52px] w-full rounded-xl border border-solid bg-neutral-50 px-4 py-3 text-base leading-6 text-neutral-900 outline-none transition-colors duration-150 placeholder:text-neutral-500 focus-visible:border-foundy-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-foundy-primary/10 disabled:cursor-wait disabled:bg-neutral-100 ${trailingAction ? "pr-12" : ""} ${error ? "border-red-600" : "border-transparent hover:border-neutral-300"} ${className}`}
        />
        {trailingAction}
      </div>
      {error ? (
        <p id={errorId} className="m-0 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
