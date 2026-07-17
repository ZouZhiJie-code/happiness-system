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
        <label htmlFor="register-username" className="font-mono text-[0.7rem] tracking-[0.22em] text-[#6a5e53]">
          用户名
        </label>
        <input
          id="register-username"
          name="username"
          autoComplete="username"
          className="min-h-12 rounded-[18px] border border-[rgba(115,77,39,0.18)] bg-white/70 px-4 py-3 text-sm text-[#2f2217] outline-none transition-colors focus:border-[rgba(168,124,69,0.4)]"
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
        <p id="register-username-help" className={`text-xs leading-5 ${touched.username && !usernameValid ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
          {touched.username && !usernameValid ? "请输入 3–24 位中文、字母、数字或下划线。" : "3–24 位，支持中文、字母、数字和下划线。"}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="register-password" className="font-mono text-[0.7rem] tracking-[0.22em] text-[#6a5e53]">
          密码
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="min-h-12 rounded-[18px] border border-[rgba(115,77,39,0.18)] bg-white/70 px-4 py-3 text-sm text-[#2f2217] outline-none transition-colors focus:border-[rgba(168,124,69,0.4)]"
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
        <p id="register-password-help" className={`text-xs leading-5 ${touched.password && !passwordValid ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
          {touched.password && !passwordValid ? "请输入 8–72 位密码。" : "8–72 位。当前账户使用用户名与密码登录，请妥善保存。"}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="register-confirm-password" className="font-mono text-[0.7rem] tracking-[0.22em] text-[#6a5e53]">
          确认密码
        </label>
        <input
          id="register-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="min-h-12 rounded-[18px] border border-[rgba(115,77,39,0.18)] bg-white/70 px-4 py-3 text-sm text-[#2f2217] outline-none transition-colors focus:border-[rgba(168,124,69,0.4)]"
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
        <p id="register-confirm-password-help" className={`text-xs leading-5 ${touched.confirmPassword && !confirmPasswordValid ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
          {touched.confirmPassword && !confirmPasswordValid ? "两次输入的密码需要保持一致。" : "再次输入密码，确认内容一致。"}
        </p>
      </div>

      <div className="rounded-[22px] border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm leading-7 text-[#4c3d30]">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-[#d89d59]"
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
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        <button
          type="submit"
          className="wood-chip min-h-12 rounded-full px-5 py-3 text-sm tracking-[0.12em] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit || submitting}
        >
          {submitting ? "创建中…" : "创建账户"}
        </button>
        <p className="text-pretty text-sm leading-7 text-[#5a4632]">
          已经有账户了？
          <Link href={loginHref} className="ml-1 underline underline-offset-4">
            去登录
          </Link>
        </p>
      </div>

      {mergedError ? (
        <p role="alert" className="text-sm leading-7 text-[#8a5440]">
          {mergedError}
        </p>
      ) : null}
    </form>
  );
}
