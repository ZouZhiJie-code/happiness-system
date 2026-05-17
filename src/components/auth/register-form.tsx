"use client";

import Link from "next/link";
import React from "react";
import { useMemo, useState } from "react";

import { LegalConsentLinks } from "@/components/auth/legal-consent-links";

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
}

export function RegisterForm({ onSubmit, error, onInteraction }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const mergedError = localError ?? error ?? null;

  const canSubmit = useMemo(() => {
    return acceptedTerms && acceptedPrivacy && username.trim().length > 0 && password.length > 0 && confirmPassword.length > 0;
  }, [acceptedPrivacy, acceptedTerms, confirmPassword.length, password.length, username]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
        acceptedTerms,
        acceptedPrivacy
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
        />
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
        />
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
        />
      </div>

      <div className="rounded-[22px] border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm leading-7 text-[#4c3d30]">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-[#d89d59]"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              我已阅读并同意
              <Link href="/legal/terms" className="ml-1 underline underline-offset-4">
                《用户协议》
              </Link>
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-[#d89d59]"
              checked={acceptedPrivacy}
              onChange={(event) => setAcceptedPrivacy(event.target.checked)}
            />
            <span>
              我已阅读并同意
              <Link href="/legal/privacy" className="ml-1 underline underline-offset-4">
                《隐私政策》
              </Link>
            </span>
          </label>
        </div>
      </div>

      <LegalConsentLinks />

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
          <Link href="/login" className="ml-1 underline underline-offset-4">
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
