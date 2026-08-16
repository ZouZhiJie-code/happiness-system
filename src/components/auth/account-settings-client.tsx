"use client";

import React from "react";

import { AccountDangerZone } from "@/components/auth/account-danger-zone";
import { clearLocalAuthUserId, getLocalAuthUserId, getScopedLocalStorageKey } from "@/features/auth/auth-local";
import {
  clearStoredInterviewSessionId,
  interviewDimensionStorageKey,
  interviewDimensions,
  interviewSessionStorageKey
} from "@/features/interview/dimensions";

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

function leaveAccount(path: string) {
  window.location.replace(path);
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
    leaveAccount("/");
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
      const responsePayload = await response.json().catch(() => null);
      throw new Error(
        responsePayload?.error === "INVALID_DELETE_ACCOUNT_REQUEST"
          ? "密码格式有误，请输入 8–72 位密码"
          : responsePayload?.error === "INVALID_CREDENTIALS"
            ? "当前密码不正确"
            : "删除账号失败，请重试"
      );
    }

    clearInterviewClientState();
    leaveAccount("/");
  }

  return (
    <AccountDangerZone
      username={user?.username ?? "未登录"}
      onLogout={handleLogout}
      onDeleteAccount={handleDeleteAccount}
      showLogout={false}
    />
  );
}
