"use client";

import React from "react";
import { useState } from "react";

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
    <section className="paper-panel rounded-[28px] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">账户危险区</p>
          <h2 className="mt-3 text-balance font-display text-3xl leading-[1.02] text-[#231d17]">管理退出与注销</h2>
        </div>
        <span className="rounded-full border border-[rgba(160,112,96,0.2)] bg-[rgba(255,244,239,0.75)] px-3 py-1.5 font-mono text-[0.68rem] tracking-[0.2em] text-[#8a5440]">
          高风险操作
        </span>
      </div>

      <p className="mt-4 text-pretty text-sm leading-8 text-[#5a4632]">
        当前账户：<span className="font-medium text-[#2f2217]">{username}</span>。退出登录只会结束当前设备会话；删除账号会清空与该账户关联的日志、访谈、评分和画像数据。
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-[18px] border border-[rgba(160,112,96,0.26)] bg-[rgba(255,245,241,0.8)] px-4 py-3 text-sm text-[#8a5440]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="min-h-12 rounded-full border border-[rgba(115,77,39,0.16)] bg-[rgba(255,249,239,0.7)] px-5 py-3 text-sm text-[#5a4632] transition-colors hover:bg-[rgba(255,249,239,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleLogout}
          disabled={loggingOut || deleting}
        >
          {loggingOut ? "退出中…" : "退出登录"}
        </button>
        <button
          type="button"
          className="min-h-12 rounded-full border border-[rgba(160,112,96,0.3)] bg-[rgba(255,241,236,0.88)] px-5 py-3 text-sm text-[#8a5440] transition-colors hover:bg-[rgba(255,233,226,0.96)] disabled:cursor-not-allowed disabled:opacity-60"
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
            className="w-full max-w-md rounded-[28px] border border-[rgba(115,77,39,0.18)] bg-[rgba(249,238,216,0.98)] p-5 shadow-lg"
          >
            <h3 id="delete-account-title" className="font-display text-2xl text-[#231d17]">
              删除账号确认
            </h3>
            <p id="delete-account-description" className="mt-3 text-pretty text-sm leading-7 text-[#5a4632]">
              这会删除当前账户的全部个人数据。输入当前密码后才能继续。
            </p>

            <div className="mt-5 grid gap-2">
              <label htmlFor="delete-account-password" className="font-mono text-[0.7rem] tracking-[0.22em] text-[#6a5e53]">
                输入当前密码以确认删除
              </label>
              <input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                className="min-h-12 rounded-[18px] border border-[rgba(115,77,39,0.18)] bg-white/70 px-4 py-3 text-sm text-[#2f2217] outline-none transition-colors focus:border-[rgba(168,124,69,0.4)]"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-full border border-[rgba(115,77,39,0.16)] px-4 py-2.5 text-sm text-[#5a4632] transition-colors hover:bg-[rgba(255,249,239,0.7)]"
                onClick={() => {
                  setDialogOpen(false);
                  setPassword("");
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="min-h-11 rounded-full border border-[rgba(160,112,96,0.3)] bg-[rgba(255,241,236,0.88)] px-4 py-2.5 text-sm text-[#8a5440] transition-colors hover:bg-[rgba(255,233,226,0.96)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleDelete}
                disabled={password.trim().length === 0 || deleting}
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

