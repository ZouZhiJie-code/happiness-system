"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { normalizeAuthRedirectPath, setLocalAuthUserId } from "@/features/auth/auth-local";
import { RegisterForm } from "@/components/auth/register-form";

interface RegisterPageClientProps {
  nextPath?: string | null;
}

export function RegisterPageClient({ nextPath = null }: RegisterPageClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthFormShell
      eyebrow="注册"
      title="先建立账户，再把每天的记录真正归到自己名下。"
      description="注册完成后，后续的访谈、日志、评分和画像都会和当前账户绑定，支持基础隐私隔离。"
      footer="注册时需要勾选《用户协议》和《隐私政策》。这一步先把数据归属和使用边界讲清楚。"
    >
      <RegisterForm
        error={error}
        onInteraction={() => {
          if (error) {
            setError(null);
          }
        }}
        onSubmit={async (values) => {
          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              username: values.username,
              password: values.password,
              acceptedTerms: values.acceptedTerms,
              acceptedPrivacy: values.acceptedPrivacy
            })
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            const nextError =
              payload?.error === "INVALID_REGISTER_REQUEST"
                ? "用户名仅支持 3-24 位中文、字母、数字或下划线，密码需至少 8 位"
                : payload?.error === "USERNAME_ALREADY_EXISTS"
                  ? "这个用户名已经被占用"
                  : payload?.error === "AUTH_STORAGE_NOT_READY"
                    ? "注册暂时不可用，请先完成数据库初始化"
                  : "注册失败，请重试";
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
    </AuthFormShell>
  );
}
