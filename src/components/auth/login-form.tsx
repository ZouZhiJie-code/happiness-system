"use client";

import Link from "next/link";
import React from "react";
import { useState } from "react";

import { passwordSchema, usernameSchema } from "@/features/auth/auth.schema";

interface LoginFormValues {
  username: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => Promise<void>;
  onInteraction?: () => void;
  nextPath?: string | null;
}

export function LoginForm({ onSubmit, onInteraction, nextPath = null }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const usernameValid = usernameSchema.safeParse(username).success;
  const passwordValid = passwordSchema.safeParse(password).success;
  const canSubmit = usernameValid && passwordValid && !submitting;
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : "/register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ username: true, password: true });

    if (!usernameValid || !passwordValid) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        username: username.trim(),
        password
      });
    } catch {
      // The parent owns login error presentation.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" method="post" action="/api/auth/login" onSubmit={handleSubmit}>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <div className="grid gap-2">
        <label htmlFor="login-username" className="font-mono text-[0.7rem] tracking-[0.22em] text-[#6a5e53]">
          用户名
        </label>
        <input
          id="login-username"
          name="username"
          autoComplete="username"
          className="min-h-12 rounded-[18px] border border-[rgba(115,77,39,0.18)] bg-white/70 px-4 py-3 text-sm text-[#2f2217] outline-none transition-colors focus:border-[rgba(168,124,69,0.4)]"
          value={username}
          onFocus={onInteraction}
          onChange={(event) => setUsername(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, username: true }))}
          aria-invalid={touched.username && !usernameValid}
          aria-describedby="login-username-help"
        />
        <p id="login-username-help" className={`text-xs leading-5 ${touched.username && !usernameValid ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
          {touched.username && !usernameValid ? "请输入 3–24 位中文、字母、数字或下划线。" : "3–24 位，支持中文、字母、数字和下划线。"}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="login-password" className="font-mono text-[0.7rem] tracking-[0.22em] text-[#6a5e53]">
          密码
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="min-h-12 rounded-[18px] border border-[rgba(115,77,39,0.18)] bg-white/70 px-4 py-3 text-sm text-[#2f2217] outline-none transition-colors focus:border-[rgba(168,124,69,0.4)]"
          value={password}
          onFocus={onInteraction}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          aria-invalid={touched.password && !passwordValid}
          aria-describedby="login-password-help"
        />
        <p id="login-password-help" className={`text-xs leading-5 ${touched.password && !passwordValid ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
          {touched.password && !passwordValid ? "请输入 8–72 位密码。" : "密码长度为 8–72 位。"}
        </p>
      </div>

      <div className="grid gap-3">
        <button
          type="submit"
          className="wood-chip min-h-12 rounded-full px-5 py-3 text-sm tracking-[0.12em] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit}
        >
          {submitting ? "登录中…" : "登录并继续"}
        </button>
        <p className="text-xs leading-6 text-[var(--text-faint)]">
          登录即表示你已阅读并同意
          <Link href="/legal/terms" target="_blank" rel="noreferrer" className="mx-1 underline underline-offset-4">
            《用户协议》
          </Link>
          和
          <Link href="/legal/privacy" target="_blank" rel="noreferrer" className="mx-1 underline underline-offset-4">
            《隐私政策》
          </Link>
          ，并知悉服务会使用对话、AI 生成内容及反馈进行质量评估与持续改进。
        </p>
        <p className="text-pretty text-sm leading-7 text-[#5a4632]">
          请使用注册时保存的密码。还没有账户？
          <Link href={registerHref} className="ml-1 underline underline-offset-4">
            去注册
          </Link>
        </p>
      </div>
    </form>
  );
}
