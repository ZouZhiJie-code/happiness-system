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
      title="把今天的记录，重新接回你自己的账户。"
      description="登录后，访谈、日志、日历和画像都会回到你自己的数据空间里。"
      footer="首版账户体系先提供用户名与密码登录，后续再补找回密码和更多绑定能力。"
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
