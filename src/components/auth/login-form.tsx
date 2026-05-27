"use client";

import Link from "next/link";
import React from "react";
import { useState } from "react";

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        />
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
        />
      </div>

      <div className="grid gap-3">
        <button
          type="submit"
          className="wood-chip min-h-12 rounded-full px-5 py-3 text-sm tracking-[0.12em] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "登录中…" : "登录并继续"}
        </button>
        <p className="text-pretty text-sm leading-7 text-[#5a4632]">
          首版暂不支持找回密码，请妥善保管。还没有账户？
          <Link href="/register" className="ml-1 underline underline-offset-4">
            去注册
          </Link>
        </p>
      </div>
    </form>
  );
}
