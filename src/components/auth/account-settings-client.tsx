"use client";

import React from "react";

import { AccountDangerZone } from "@/components/auth/account-danger-zone";
import { clearLocalAuthUserId, getLocalAuthUserId } from "@/features/auth/auth-local";
import { StatusPill } from "@/components/shared/status-pill";
import { Surface } from "@/components/ui";
import { getScopedLocalStorageKey } from "@/features/auth/auth-local";
import { clearStoredInterviewSessionId, interviewDimensionStorageKey, interviewDimensions, interviewSessionStorageKey } from "@/features/interview/dimensions";

function clearInterviewClientState() {
  if (typeof window === "undefined") {
    return;
  }

  const localAuthUserId = getLocalAuthUserId();
  interviewDimensions.forEach((dimension) => {
    clearStoredInterviewSessionId(dimension);
  });
  if (localAuthUserId) {
    window.localStorage.removeItem(getScopedLocalStorageKey(interviewSessionStorageKey, localAuthUserId));
    window.localStorage.removeItem(getScopedLocalStorageKey(interviewDimensionStorageKey, localAuthUserId));
  }
  clearLocalAuthUserId();
}

type SessionUser = {
  id: string;
  username: string;
} | null;

interface AccountSettingsClientProps {
  user: SessionUser;
}

export function AccountSettingsClient({ user }: AccountSettingsClientProps) {

  async function handleLogout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("退出登录失败，请重试");
    }

    clearInterviewClientState();
    window.location.href = "/login";
  }

  async function handleDeleteAccount(payload: { password: string }) {
    const response = await fetch("/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("删除账号失败，请重试");
    }

    clearInterviewClientState();
    window.location.href = "/register";
  }

  return (
    <div className="min-h-0 flex-1">
      <Surface
        as="section"
        className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
      >
        <div className="relative z-10 grid min-h-0 gap-7 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <div className="max-w-[38rem]">
            <StatusPill label="账户设置" tone="warm" />
            <p className="archive-label mt-6">数据归属</p>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.96] text-ink md:text-6xl">
              管理登录状态与账号删除
            </h1>
            <p className="mt-4 text-pretty text-sm leading-8 text-ink/76">
              这里已经接入首版账户危险区。你可以退出当前账户，也可以提交密码确认删除账号与关联数据。
            </p>
          </div>

          <AccountDangerZone
            username={user?.username ?? "未登录"}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        </div>
      </Surface>
    </div>
  );
}
