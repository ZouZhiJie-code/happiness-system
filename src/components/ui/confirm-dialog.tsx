"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ActionButton } from "@/components/ui/action-button";

export type ConfirmTone = "default" | "danger";

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
  /**
   * 经 portal 渲染到 document.body。
   * 当弹窗的祖先存在 backdrop-filter / transform 等会成为 fixed 包含块的样式时需要开启（如毛玻璃顶栏）。
   */
  portal?: boolean;
}

/**
 * 全站统一的确认弹窗（暖纸 + 琥珀金，对齐单层卡片制）。
 * 受控用法：传 open / onConfirm / onCancel。需要命令式 await 时用 useConfirmDialog。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  eyebrow = "确认",
  confirmLabel = "确定",
  cancelLabel = "取消",
  tone = "default",
  confirmDisabled = false,
  onConfirm,
  onCancel,
  testId = "confirm-dialog",
  portal = false
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const overlay = (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(32,24,17,0.48)] px-4 py-6 backdrop-blur-[2px] md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="w-full max-w-md rounded-[30px] border border-[rgba(153,103,54,0.16)] bg-[linear-gradient(180deg,rgba(252,246,236,0.98),rgba(235,217,187,0.96))] p-5 shadow-[0_24px_60px_rgba(46,35,25,0.22)]"
      >
        <p
          className={`font-mono text-[0.65rem] tracking-[0.22em] ${tone === "danger" ? "text-[#9f5a3a]" : "text-[#9a734d]"}`}
        >
          {eyebrow}
        </p>
        <h3 className="mt-2 font-display text-[1.5rem] text-[#2e2319]">{title}</h3>
        {description ? <p className="mt-3 text-sm leading-7 text-[#594537]">{description}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <ActionButton type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </ActionButton>
          <ActionButton type="button" variant="primary" autoFocus disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );

  if (portal && typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }

  return overlay;
}

/**
 * 命令式确认：const { confirm, confirmDialog } = useConfirmDialog();
 * 用 `if (await confirm({...}))` 平替 window.confirm，并在 JSX 里渲染 {confirmDialog}。
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
      portal
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
