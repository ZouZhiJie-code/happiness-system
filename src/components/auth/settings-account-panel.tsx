"use client";

import React from "react";

import {
  clearLocalAuthUserId,
  getLocalAuthUserId,
  getScopedLocalStorageKey
} from "@/features/auth/auth-local";
import {
  clearStoredInterviewSessionId,
  interviewDimensionStorageKey,
  interviewDimensions,
  interviewSessionStorageKey
} from "@/features/interview/dimensions";

type SessionUser = {
  id: string;
  username: string;
} | null;

interface SettingsAccountPanelProps {
  user: SessionUser;
  showAdminAnalyticsEntry?: boolean;
}

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

export function SettingsAccountPanel({ user, showAdminAnalyticsEntry = false }: SettingsAccountPanelProps) {
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("退出登录失败，请重试");
      }

      clearInterviewClientState();
      window.location.href = "/login";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "退出登录失败，请重试");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">账户状态</p>
          <h3 className="mt-3 font-display text-2xl text-[#231d17]">退出当前账号</h3>
        </div>
        <span className="wood-chip rounded-full px-4 py-2 text-xs tracking-[0.16em]">已登录</span>
      </div>

      <p className="mt-3 text-pretty text-sm leading-8 text-[#524436]">
        当前账号：<span className="font-medium text-[#2f2217]">{user?.username ?? "未登录"}</span>。退出后会结束当前设备会话，并清掉这台设备上的本地恢复记录。
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-[18px] border border-[rgba(160,112,96,0.26)] bg-[rgba(255,245,241,0.8)] px-4 py-3 text-sm text-[#8a5440]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded-full border border-[rgba(115,77,39,0.16)] bg-[rgba(255,249,239,0.7)] px-5 py-3 text-sm text-[#5a4632] transition-colors hover:bg-[rgba(255,249,239,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "退出中…" : "退出当前账号"}
        </button>
        <a
          href="/settings/account"
          className="inline-flex min-h-11 items-center rounded-full border border-[rgba(115,77,39,0.16)] px-5 py-3 text-sm text-[#5a4632] transition-colors hover:bg-[rgba(255,249,239,0.55)]"
        >
          管理注销与高风险操作
        </a>
        {showAdminAnalyticsEntry ? (
          <a
            href="/admin/analytics"
            className="inline-flex min-h-11 items-center rounded-full border border-[rgba(115,77,39,0.16)] px-5 py-3 text-sm text-[#5a4632] transition-colors hover:bg-[rgba(255,249,239,0.55)]"
          >
            管理员数据分析
          </a>
        ) : null}
      </div>
    </aside>
  );
}
