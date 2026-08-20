"use client";

import Link from "next/link";
import React from "react";
import { useMemo, useState } from "react";

import { passwordSchema, usernameSchema } from "@/features/auth/auth.schema";

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

interface RegisterFormProps {
  onSubmit: (values: RegisterFormValues) => Promise<void>;
  error?: string | null;
  onInteraction?: () => void;
  nextPath?: string | null;
}

export function RegisterForm({ onSubmit, error, onInteraction, nextPath = null }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedAgreements, setAcceptedAgreements] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ username: false, password: false, confirmPassword: false });
  const mergedError = localError ?? error ?? null;
  const usernameValid = usernameSchema.safeParse(username).success;
  const passwordValid = passwordSchema.safeParse(password).success;
  const confirmPasswordValid = confirmPassword.length > 0 && password === confirmPassword;
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  const canSubmit = useMemo(() => {
    return acceptedAgreements && usernameValid && passwordValid && confirmPasswordValid;
  }, [acceptedAgreements, confirmPasswordValid, passwordValid, usernameValid]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ username: true, password: true, confirmPassword: true });

    if (!usernameValid || !passwordValid || !confirmPasswordValid || !acceptedAgreements) {
      if (password !== confirmPassword && confirmPassword.length > 0) {
        setLocalError("两次输入的密码不一致");
      }
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      await onSubmit({
        username: username.trim(),
        password,
        confirmPassword,
        acceptedTerms: acceptedAgreements,
        acceptedPrivacy: acceptedAgreements
      });
    } catch {
      // The parent owns request error presentation.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label htmlFor="register-username" className="text-[13px] font-medium text-[var(--color-ink)]">
          用户名
        </label>
        <input
          id="register-username"
          name="username"
          autoComplete="username"
          className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 py-3 text-[15px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--line-strong)]"
          value={username}
          onFocus={() => {
            setLocalError(null);
            onInteraction?.();
          }}
          onChange={(event) => setUsername(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, username: true }))}
          aria-invalid={touched.username && !usernameValid}
          aria-describedby="register-username-help"
        />
        <p id="register-username-help" className={`text-[13px] leading-5 ${touched.username && !usernameValid ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
          {touched.username && !usernameValid ? "请输入 3–24 位中文、字母、数字或下划线。" : "3–24 位，支持中文、字母、数字和下划线。"}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="register-password" className="text-[13px] font-medium text-[var(--color-ink)]">
          密码
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 py-3 text-[15px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--line-strong)]"
          value={password}
          onFocus={() => {
            setLocalError(null);
            onInteraction?.();
          }}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          aria-invalid={touched.password && !passwordValid}
          aria-describedby="register-password-help"
        />
        <p id="register-password-help" className={`text-[13px] leading-5 ${touched.password && !passwordValid ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
          {touched.password && !passwordValid ? "请输入 8–72 位密码。" : "8–72 位。当前账户使用用户名与密码登录，请妥善保存。"}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="register-confirm-password" className="text-[13px] font-medium text-[var(--color-ink)]">
          确认密码
        </label>
        <input
          id="register-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 py-3 text-[15px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--line-strong)]"
          value={confirmPassword}
          onFocus={() => {
            setLocalError(null);
            onInteraction?.();
          }}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
          aria-invalid={touched.confirmPassword && !confirmPasswordValid}
          aria-describedby="register-confirm-password-help"
        />
        <p id="register-confirm-password-help" className={`text-[13px] leading-5 ${touched.confirmPassword && !confirmPasswordValid ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
          {touched.confirmPassword && !confirmPasswordValid ? "两次输入的密码需要保持一致。" : "再次输入密码，确认内容一致。"}
        </p>
      </div>

      <div className="rounded-[var(--radius-control)] bg-[var(--color-sidebar)] p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm leading-7 text-[var(--color-ink)]">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-action)]"
              checked={acceptedAgreements}
              onChange={(event) => setAcceptedAgreements(event.target.checked)}
            />
            <span>
              我已阅读并同意
              <Link href="/legal/terms" target="_blank" rel="noreferrer" className="mx-1 underline underline-offset-4">
                《用户协议》
              </Link>
              和
              <Link href="/legal/privacy" target="_blank" rel="noreferrer" className="mx-1 underline underline-offset-4">
                《隐私政策》
              </Link>
              。
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        <button
          type="submit"
          className="min-h-12 rounded-[var(--radius-control)] bg-[var(--color-action)] px-5 py-3 text-[15px] font-semibold text-[var(--color-content)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit || submitting}
        >
          {submitting ? "创建中…" : "创建账户"}
        </button>
        <p className="text-pretty text-sm leading-7 text-[var(--color-muted)]">
          已经有账户了？
          <Link href={loginHref} className="ml-1 underline underline-offset-4">
            去登录
          </Link>
        </p>
      </div>

      {mergedError ? (
        <p role="alert" className="text-sm leading-7 text-[var(--color-danger)]">
          {mergedError}
        </p>
      ) : null}
    </form>
  );
}
