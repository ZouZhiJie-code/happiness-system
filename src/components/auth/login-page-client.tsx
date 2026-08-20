"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { normalizeAuthRedirectPath, setLocalAuthUserId } from "@/features/auth/auth-local";
import { LoginForm } from "@/components/auth/login-form";

interface LoginPageClientProps {
  nextPath?: string | null;
}

export function LoginPageClient({ nextPath = null }: LoginPageClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthFormShell
      eyebrow="登录"
      title="回来继续记录"
      description="登录后，你可以接着聊，也可以回到过去的日记。"
      footer="使用注册时设置的用户名和密码。"
    >
      <LoginForm
        nextPath={nextPath}
        onInteraction={() => {
          if (error) {
            setError(null);
          }
        }}
        onSubmit={async (values) => {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(values)
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            const nextError =
              payload?.error === "INVALID_LOGIN_REQUEST"
                ? "登录信息格式不正确"
                : payload?.error === "INVALID_CREDENTIALS"
                  ? "用户名或密码不正确"
                  : payload?.error === "AUTH_STORAGE_NOT_READY"
                    ? "登录暂时不可用，请稍后再试"
                    : "登录失败，请重试";
            setError(nextError);
            throw new Error(nextError);
          }

          if (payload?.user?.id) {
            setLocalAuthUserId(payload.user.id);
          }
          setError(null);
          router.replace(normalizeAuthRedirectPath(nextPath));
          router.refresh();
        }}
      />
      {error ? <p role="alert" className="mt-4 text-sm leading-7 text-[var(--color-danger)]">{error}</p> : null}
    </AuthFormShell>
  );
}
