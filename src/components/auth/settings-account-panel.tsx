"use client";

import React from "react";

import { ActionButton, Divider, actionButtonClass } from "@/components/ui";
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
  showAdminAIRuntimeEntry?: boolean;
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

export function SettingsAccountPanel({
  user,
  showAdminAnalyticsEntry = false,
  showAdminAIRuntimeEntry = false
}: SettingsAccountPanelProps) {
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
    <aside className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">账户状态</p>
          <h3 className="mt-3 font-display text-2xl text-ink">退出当前账号</h3>
        </div>
        <span className="wood-chip rounded-full px-4 py-2 text-xs tracking-[0.16em]">已登录</span>
      </div>

      <p className="text-pretty text-sm leading-8 text-[var(--text-dim)]">
        当前账号：<span className="font-medium text-ink">{user?.username ?? "未登录"}</span>。退出后会结束当前设备会话，并清掉这台设备上的本地恢复记录。
      </p>

      {error ? (
        <p role="alert" className="text-sm leading-7 text-[#8a5440]">
          {error}
        </p>
      ) : null}

      <Divider />

      <div className="flex items-center">
        <ActionButton
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "退出中…" : "退出当前账号"}
        </ActionButton>
      </div>

      <Divider />

      <div className="flex items-center">
        <a href="/settings/account" className={actionButtonClass("ghost", "min-h-11")}>
          管理注销与高风险操作
        </a>
      </div>
      {showAdminAIRuntimeEntry ? (
        <>
          <Divider />
          <div className="flex items-center">
            <a href="/settings/ai-runtime" className={actionButtonClass("ghost", "min-h-11")}>
              AI 运行配置中心
            </a>
          </div>
        </>
      ) : null}
      {showAdminAnalyticsEntry ? (
        <>
          <Divider />
          <div className="flex items-center">
            <a href="/admin/analytics" className={actionButtonClass("ghost", "min-h-11")}>
              管理员数据分析
            </a>
          </div>
        </>
      ) : null}
    </aside>
  );
}
