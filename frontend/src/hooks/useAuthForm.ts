"use client";

import { ApiError } from "@/lib/api/client";
import type { SignInHandler, SignUpCredentials, SignUpHandler } from "@/types/auth";
import { useRef, useState, type FormEvent } from "react";

export type AuthFormAction =
  | { mode: "login"; submit?: SignInHandler }
  | { mode: "signup"; submit?: SignUpHandler };

type AuthField = keyof SignUpCredentials;
type FieldErrors = Partial<Record<AuthField, string>>;

function validate(fields: SignUpCredentials, signingUp: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.username) errors.username = "아이디를 입력해 주세요.";
  if (!fields.password) errors.password = "비밀번호를 입력해 주세요.";
  if (!signingUp) return errors;

  if (!fields.name) errors.name = "이름을 입력해 주세요.";
  else if (Array.from(fields.name).length > 30) errors.name = "이름은 30자 이내로 입력해 주세요.";
  if (fields.username && !/^[a-z0-9]{4,20}$/i.test(fields.username)) {
    errors.username = "아이디는 영문과 숫자로 4~20자 입력해 주세요.";
  }
  if (fields.password && Array.from(fields.password).length < 8) {
    errors.password = "비밀번호는 8자 이상 입력해 주세요.";
  } else if (new TextEncoder().encode(fields.password).length > 72) {
    errors.password = "비밀번호가 너무 길어요. 영문 기준 72자 이내로 입력해 주세요.";
  }
  return errors;
}

/** Holds form state, validates it, and delegates to the corresponding auth action. */
export function useAuthForm(action: AuthFormAction) {
  const [fields, setFields] = useState<SignUpCredentials>({ name: "", username: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const signingUp = action.mode === "signup";
  const label = signingUp ? "회원가입" : "로그인";

  function updateField(field: AuthField, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (submitting.current) return;

    const normalized = { name: fields.name.trim(), username: fields.username.trim(), password: fields.password };
    const errors = validate(normalized, signingUp);
    setFieldErrors(errors);
    setError("");

    const form = event.currentTarget;
    const firstInvalid = (["name", "username", "password"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      const input = form.elements.namedItem(firstInvalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    if (!action.submit) {
      setError(label + " 연결을 준비 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    submitting.current = true;
    setPending(true);
    try {
      if (action.mode === "signup") await action.submit(normalized);
      else await action.submit({ username: normalized.username, password: normalized.password });
      setFields((current) => ({ ...current, password: "" }));
    } catch (cause) {
      if (signingUp && cause instanceof ApiError && cause.code === "USERNAME_TAKEN") {
        setFieldErrors({ username: cause.message });
        const input = form.elements.namedItem("username");
        if (input instanceof HTMLInputElement) {
          // The field is disabled until the pending state clears.
          requestAnimationFrame(() => input.focus());
        }
      } else if (cause instanceof ApiError) {
        setError(cause.message);
      } else if (signingUp) {
        setError("회원가입을 마치지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.");
      } else {
        setError("로그인하지 못했어요. 아이디와 비밀번호를 확인하고 다시 시도해 주세요.");
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return { fields, fieldErrors, error, pending, updateField, handleSubmit };
}
