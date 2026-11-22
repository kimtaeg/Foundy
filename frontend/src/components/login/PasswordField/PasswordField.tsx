"use client";

import { LoginField, type LoginFieldProps } from "@/components/login/LoginField";
import { useState } from "react";

export type PasswordFieldProps = Omit<LoginFieldProps, "type" | "trailingAction">;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <LoginField
      {...props}
      type={visible ? "text" : "password"}
      trailingAction={
        <button
          type="button"
          aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
          aria-controls={props.id}
          aria-pressed={visible}
          disabled={props.disabled}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-neutral-500 transition-colors duration-150 hover:text-foundy-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary disabled:cursor-wait"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible ? <path d="m3 3 18 18" /> : null}
          </svg>
        </button>
      }
    />
  );
}
