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
      title="登录 Daily Light，继续今天的记录。"
      description="访谈、日志、日历和画像都会保存在你的个人数据空间。"
      footer="请使用注册时设置的用户名与密码。"
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
                    ? "登录暂时不可用，请先完成数据库初始化"
                  : "登录失败，请重试";
            setError(nextError);
            throw new Error(nextError);
          }

          if (payload?.user?.id) {
            setLocalAuthUserId(payload.user.id);
          }
          setError(null);
          router.push(normalizeAuthRedirectPath(nextPath));
          router.refresh();
        }}
      />
      {error ? <p role="alert" className="mt-4 text-sm leading-7 text-[#8a5440]">{error}</p> : null}
    </AuthFormShell>
  );
}
