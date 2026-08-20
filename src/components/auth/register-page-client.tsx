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
      title="创建你的 Daily Light 账户"
      description="记录、日记和回看内容会保存在这个账户中。"
      footer="注册完成后会直接进入记录页。"
    >
      <RegisterForm
        nextPath={nextPath}
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
                    ? "注册暂时不可用，请稍后再试"
                    : "注册失败，请重试";
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
    </AuthFormShell>
  );
}
