"use client";

import { LoginField } from "@/components/login/LoginField";
import { PasswordField } from "@/components/login/PasswordField";
import { LoginSubmitButton } from "@/components/login/LoginSubmitButton";
import { useAuthForm } from "@/hooks/useAuthForm";
import type { SignInHandler, SignUpHandler } from "@/types/auth";
import { useId, type SyntheticEvent } from "react";

export type LoginFormProps = (
  | { mode?: "login"; onSignIn?: SignInHandler }
  | { mode: "signup"; onSignUp?: SignUpHandler }
) & { onSwitch?: () => void };

export function LoginForm(props: LoginFormProps = {}) {
  const id = useId();
  const signingUp = props.mode === "signup";
  const label = signingUp ? "회원가입" : "로그인";
  const { fields, fieldErrors, error, pending, updateField, handleSubmit } = useAuthForm(
    props.mode === "signup"
      ? { mode: "signup", submit: props.onSignUp }
      : { mode: "login", submit: props.onSignIn },
  );
  const stopDelegation = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <form
      method="post"
      noValidate
      aria-label={label}
      aria-busy={pending}
      className="flex flex-col gap-7"
      onSubmit={handleSubmit}
      onClick={stopDelegation}
      onInput={stopDelegation}
      onChange={stopDelegation}
      onKeyDown={stopDelegation}
    >
      <div className="flex flex-col gap-5">
        {signingUp ? (
          <LoginField
            id={id + "-name"}
            name="name"
            label="이름"
            type="text"
            autoComplete="name"
            placeholder="이름 입력"
            required
            disabled={pending}
            value={fields.name}
            error={fieldErrors.name}
            onChange={(event) => updateField("name", event.currentTarget.value)}
          />
        ) : null}
        <LoginField
          id={id + "-username"}
          name="username"
          label="아이디"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={signingUp ? "영문과 숫자 4~20자" : "아이디 입력"}
          required
          disabled={pending}
          value={fields.username}
          error={fieldErrors.username}
          onChange={(event) => updateField("username", event.currentTarget.value)}
        />
        <PasswordField
          id={id + "-password"}
          name="password"
          label="비밀번호"
          autoComplete={signingUp ? "new-password" : "current-password"}
          placeholder={signingUp ? "비밀번호 8자 이상" : "비밀번호 입력"}
          required
          disabled={pending}
          value={fields.password}
          error={fieldErrors.password}
          onChange={(event) => updateField("password", event.currentTarget.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="m-0 text-sm leading-6 text-red-700">
          {error}
        </p>
      ) : null}
      <LoginSubmitButton pending={pending} label={label} pendingLabel={label + " 중…"} />
      {props.onSwitch ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-0 border-t border-solid border-neutral-200 pt-3 text-sm">
          <span className="font-medium text-neutral-600">
            {signingUp ? "이미 계정이 있으세요?" : "아직 계정이 없으세요?"}
          </span>
          <button
            type="button"
            onClick={props.onSwitch}
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-sm border-0 bg-transparent p-0 font-semibold text-foundy-primary-ink hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary disabled:cursor-wait disabled:opacity-50"
          >
            {signingUp ? "로그인으로 돌아가기" : "회원가입"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
