"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useRef, useState } from "react";

import { ActionButton, actionButtonClass } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

export type ConfirmTone = "default" | "danger";

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  initialFocus?: "cancel" | "confirm";
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
  /** 保留旧调用接口；Base UI 弹窗统一挂载到 document.body。 */
  portal?: boolean;
}

/**
 * 全站确认弹窗。焦点圈定、Esc、遮罩关闭和焦点恢复由 Base UI 统一处理。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  eyebrow = "确认",
  confirmLabel = "确定",
  cancelLabel = "取消",
  tone = "default",
  initialFocus,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  testId = "confirm-dialog"
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const focusTarget = (initialFocus ?? (tone === "danger" ? "cancel" : "confirm")) === "cancel"
    ? cancelRef
    : confirmRef;

  const content = (
    <>
      <Dialog.Backdrop className="ui-confirm-dialog__backdrop" />
      <Dialog.Popup
        data-testid={testId}
        className="ui-confirm-dialog__popup"
        initialFocus={focusTarget}
      >
        <p className={cn("ui-confirm-dialog__eyebrow", tone === "danger" && "ui-confirm-dialog__eyebrow--danger")}>{eyebrow}</p>
        <Dialog.Title className="ui-confirm-dialog__title">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="ui-confirm-dialog__description">{description}</Dialog.Description>
        ) : null}
        <div className="ui-confirm-dialog__actions">
          <Dialog.Close ref={cancelRef} className={actionButtonClass("secondary")}>
            {cancelLabel}
          </Dialog.Close>
          <ActionButton
            ref={confirmRef}
            type="button"
            variant="primary"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </Dialog.Popup>
    </>
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <Dialog.Portal>{content}</Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * 命令式确认：const { confirm, confirmDialog } = useConfirmDialog();
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPending(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending(options);
    });
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      title={pending?.title ?? ""}
      description={pending?.description}
      eyebrow={pending?.eyebrow}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      initialFocus={pending?.initialFocus}
      portal
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
