"use client";

import { Dialog } from "@base-ui/react/dialog";
import React from "react";
import { useRef, useState } from "react";

import { ActionButton, actionButtonClass } from "@/components/ui";
import { passwordSchema } from "@/features/auth/auth.schema";

interface DeleteAccountPayload {
  password: string;
}

interface AccountDangerZoneProps {
  username: string;
  onLogout: () => Promise<void>;
  onDeleteAccount: (payload: DeleteAccountPayload) => Promise<void>;
  showLogout?: boolean;
}

export function AccountDangerZone({ username, onLogout, onDeleteAccount, showLogout = true }: AccountDangerZoneProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordValid = passwordSchema.safeParse(password).success;

  function resetDeleteDialog() {
    setPassword("");
    setPasswordTouched(false);
    setError(null);
  }

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
      resetDeleteDialog();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "删除账号失败，请重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="grid gap-4">
      <p className="text-[13px] leading-6 text-[var(--color-muted)]">
        当前账户：<span className="font-medium text-[var(--color-ink)]">{username}</span>
      </p>

      {error && !dialogOpen ? (
        <p role="alert" className="text-sm leading-7 text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {showLogout ? (
          <ActionButton
            type="button"
            variant="secondary"
            className="min-h-11 rounded-[var(--radius-control)]"
            onClick={handleLogout}
            disabled={loggingOut || deleting}
          >
            {loggingOut ? "退出中…" : "退出登录"}
          </ActionButton>
        ) : null}
        <Dialog.Root
          open={dialogOpen}
          onOpenChange={(nextOpen) => {
            setDialogOpen(nextOpen);
            if (!nextOpen) resetDeleteDialog();
          }}
        >
          <Dialog.Trigger
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 py-2.5 text-[15px] font-medium text-[var(--color-danger)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loggingOut || deleting}
          >
            删除账号
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Backdrop className="ui-confirm-dialog__backdrop" />
            <Dialog.Popup
              className="ui-confirm-dialog__popup"
              initialFocus={passwordInputRef}
              aria-label="删除账号确认"
            >
              <p className="ui-confirm-dialog__eyebrow ui-confirm-dialog__eyebrow--danger">账户与数据</p>
              <Dialog.Title className="ui-confirm-dialog__title">删除账号确认</Dialog.Title>
              <Dialog.Description className="ui-confirm-dialog__description">
                账号删除后，访谈记录、日记、画像和设置会一起删除。请输入当前密码继续。
              </Dialog.Description>

              {error ? (
                <p role="alert" className="mt-4 text-sm leading-7 text-[var(--color-danger)]">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 grid gap-2">
                <label
                  htmlFor="delete-account-password"
                  className="text-[13px] font-medium text-[var(--color-ink)]"
                >
                  输入当前密码以确认删除
                </label>
                <input
                  ref={passwordInputRef}
                  id="delete-account-password"
                  type="password"
                  autoComplete="current-password"
                  className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 py-3 text-[15px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--line-strong)]"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  aria-invalid={passwordTouched && !passwordValid}
                  aria-describedby="delete-account-password-help"
                />
                <p id="delete-account-password-help" className={`text-[13px] leading-5 ${passwordTouched && !passwordValid ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
                  {passwordTouched && !passwordValid ? "请输入 8–72 位当前密码。" : "密码长度为 8–72 位。"}
                </p>
              </div>

              <div className="ui-confirm-dialog__actions">
                <Dialog.Close className={actionButtonClass("secondary")} disabled={deleting}>
                  取消
                </Dialog.Close>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-danger)] px-4 py-2.5 text-[15px] font-semibold text-[var(--color-content)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleDelete}
                  disabled={!passwordValid || deleting}
                >
                  {deleting ? "删除中…" : "确认删除并清空数据"}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
