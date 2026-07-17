"use client";

import React from "react";
import { useState } from "react";

import { StatusPill } from "@/components/shared/status-pill";
import { ActionButton, Divider } from "@/components/ui";
import { passwordSchema } from "@/features/auth/auth.schema";

interface DeleteAccountPayload {
  password: string;
}

interface AccountDangerZoneProps {
  username: string;
  onLogout: () => Promise<void>;
  onDeleteAccount: (payload: DeleteAccountPayload) => Promise<void>;
}

export function AccountDangerZone({ username, onLogout, onDeleteAccount }: AccountDangerZoneProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const passwordValid = passwordSchema.safeParse(password).success;

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);

    try {
      await onLogout();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "退出登录失败，请重试");
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleDelete() {
    setPasswordTouched(true);
    if (!passwordValid) {
      setError("请输入 8–72 位当前密码");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await onDeleteAccount({ password });
      setDialogOpen(false);
      setPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "删除账号失败，请重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[var(--text-faint)]">账户危险区</p>
          <h2 className="mt-3 text-balance font-display text-3xl leading-[1.02] text-ink">管理退出与注销</h2>
        </div>
        <StatusPill label="高风险操作" tone="warm" />
      </div>

      <p className="text-pretty text-sm leading-8 text-[var(--text-dim)]">
        当前账户：<span className="font-medium text-ink">{username}</span>。退出登录只会结束当前设备会话；删除账号会清空与该账户关联的日志、访谈、评分和画像数据。
      </p>

      {error ? (
        <p role="alert" className="text-sm leading-7 text-[#8a5440]">
          {error}
        </p>
      ) : null}

      <Divider />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ActionButton
          type="button"
          variant="secondary"
          className="min-h-12"
          onClick={handleLogout}
          disabled={loggingOut || deleting}
        >
          {loggingOut ? "退出中…" : "退出登录"}
        </ActionButton>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-sm text-[#8a5440] underline decoration-1 underline-offset-4 transition-colors hover:text-[#6f3f2e] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
          disabled={loggingOut || deleting}
        >
          删除账号
        </button>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            aria-label="删除账号确认"
            className="w-full max-w-md rounded-[var(--radius-shell)] border border-[var(--line-soft)] bg-[var(--paper-main)] p-5 shadow-lg"
          >
            <h3 id="delete-account-title" className="font-display text-2xl text-ink">
              删除账号确认
            </h3>
            <p id="delete-account-description" className="mt-3 text-pretty text-sm leading-7 text-[var(--text-dim)]">
              这会删除当前账户的全部个人数据。输入当前密码后才能继续。
            </p>

            <div className="mt-5 grid gap-2">
              <label
                htmlFor="delete-account-password"
                className="font-mono text-[0.7rem] tracking-[0.22em] text-[var(--text-faint)]"
              >
                输入当前密码以确认删除
              </label>
              <input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/70 px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-[var(--line-strong)]"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => setPasswordTouched(true)}
                aria-invalid={passwordTouched && !passwordValid}
                aria-describedby="delete-account-password-help"
              />
              <p id="delete-account-password-help" className={`text-xs leading-5 ${passwordTouched && !passwordValid ? "text-[#8a5440]" : "text-[var(--text-faint)]"}`}>
                {passwordTouched && !passwordValid ? "请输入 8–72 位当前密码。" : "密码长度为 8–72 位。"}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ActionButton
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={() => {
                  setDialogOpen(false);
                  setPassword("");
                  setPasswordTouched(false);
                }}
              >
                取消
              </ActionButton>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm text-[#8a5440] underline decoration-1 underline-offset-4 transition-colors hover:text-[#6f3f2e] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleDelete}
                disabled={!passwordValid || deleting}
              >
                {deleting ? "删除中…" : "确认删除并清空数据"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
