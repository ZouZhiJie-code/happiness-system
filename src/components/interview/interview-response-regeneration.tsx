"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { createPortal } from "react-dom";

import type { InterviewMessage, InterviewRegenerationIntent } from "@/types/interview";

const intentGroups: Array<{
  label: string;
  items: Array<{
    id: InterviewRegenerationIntent;
    label: string;
    description: string;
  }>;
}> = [
  {
    label: "调整问法",
    items: [
      {
        id: "simplify",
        label: "更简单一点",
        description: "保留原来的关注点，改成直白单句"
      },
      {
        id: "concretize",
        label: "更具体一点",
        description: "加入画面、动作、念头或时间锚点"
      },
      {
        id: "change_angle",
        label: "换一个角度",
        description: "避开已经聊过或不想聊的方向"
      },
      {
        id: "deepen",
        label: "再深入一点",
        description: "已有材料足够时，再往理解里走一层"
      },
      {
        id: "lighten",
        label: "问得轻一点",
        description: "缩小回答范围，一句话或小例子也可以"
      }
    ]
  }
];

type PopoverSurface = "menu" | "correction";

type PopoverLayout = {
  placement: "top" | "bottom";
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const POPOVER_MARGIN = 12;
const POPOVER_GAP = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function RegenerateIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
      />
      <path
        d="M21 3v5h-5m5 4a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
      />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="currentColor">
      <path d="m10.8 12 3.9 3.9q.275.275.275.7t-.275.7-.7.275-.7-.275l-4.6-4.6q-.15-.15-.212-.325T8.425 12t.063-.375.212-.325l4.6-4.6q.275-.275.7-.275t.7.275.275.7-.275.7z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="currentColor">
      <path d="m12.6 12-3.9-3.9q-.275-.275-.275-.7t.275-.7.7-.275.7.275l4.6 4.6q.15.15.213.325t.062.375-.062.375-.213.325l-4.6 4.6q-.275.275-.7.275t-.7-.275-.275-.7.275-.7z" />
    </svg>
  );
}

export function InterviewResponseRegeneration({
  message,
  canDeepen,
  busy,
  onRegenerate,
  onCorrectUnderstanding,
  onSwitchVersion,
  onPrefetchVersion,
  onLimitAction,
  canGenerateFromLimit
}: {
  message: InterviewMessage;
  canDeepen: boolean;
  busy: boolean;
  onRegenerate: (intent: InterviewRegenerationIntent) => Promise<void> | void;
  onCorrectUnderstanding: (rawText: string) => Promise<void> | void;
  onSwitchVersion: (messageId: string) => Promise<void> | void;
  onPrefetchVersion?: (messageId: string) => Promise<unknown> | void;
  onLimitAction: (action: "next_event" | "generate_draft" | "pause_session") => Promise<void> | void;
  canGenerateFromLimit: boolean;
}) {
  const responseVersion = message.responseVersion;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isCorrectionComposingRef = useRef(false);
  const correctionSubmitLockRef = useRef(false);
  const menuId = useId();
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [popoverLayout, setPopoverLayout] = useState<PopoverLayout | null>(null);
  const reduceMotion = useReducedMotion();
  const activeSurface: PopoverSurface | null = open ? "menu" : correcting ? "correction" : null;
  const availableGroups = useMemo(
    () =>
      intentGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.id !== "deepen" || canDeepen)
      })),
    [canDeepen]
  );
  const disabled = Boolean(
    busy ||
      localBusy ||
      (!responseVersion?.canRegenerate && (responseVersion?.versionCount ?? 0) < 3)
  );

  const updatePopoverLayout = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!activeSurface || !trigger || !popover) return;

    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const triggerRect = trigger.getBoundingClientRect();
    const preferredWidth = activeSurface === "correction" ? 384 : 352;
    const width = Math.max(0, Math.min(preferredWidth, viewportWidth - POPOVER_MARGIN * 2));
    const left = clamp(
      triggerRect.left,
      viewportLeft + POPOVER_MARGIN,
      viewportRight - POPOVER_MARGIN - width
    );
    const naturalHeight = Math.max(popover.scrollHeight, popover.getBoundingClientRect().height);
    const availableAbove = Math.max(
      0,
      triggerRect.top - viewportTop - POPOVER_MARGIN - POPOVER_GAP
    );
    const availableBelow = Math.max(
      0,
      viewportBottom - triggerRect.bottom - POPOVER_MARGIN - POPOVER_GAP
    );
    const placement: PopoverLayout["placement"] =
      availableBelow >= naturalHeight
        ? "bottom"
        : availableAbove >= naturalHeight
          ? "top"
          : availableBelow >= availableAbove
            ? "bottom"
            : "top";
    const selectedSpace = placement === "bottom" ? availableBelow : availableAbove;
    const viewportContentHeight = Math.max(0, viewportHeight - POPOVER_MARGIN * 2);
    const maxHeight = Math.min(
      viewportContentHeight,
      Math.max(Math.min(160, viewportContentHeight), selectedSpace)
    );
    const renderedHeight = Math.min(naturalHeight, maxHeight);
    const idealTop =
      placement === "bottom"
        ? triggerRect.bottom + POPOVER_GAP
        : triggerRect.top - POPOVER_GAP - renderedHeight;
    const top = clamp(
      idealTop,
      viewportTop + POPOVER_MARGIN,
      viewportBottom - POPOVER_MARGIN - renderedHeight
    );

    setPopoverLayout((current) => {
      const next = { placement, top, left, width, maxHeight };
      if (
        current?.placement === next.placement &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight
      ) {
        return current;
      }
      return next;
    });
  }, [activeSurface]);

  useLayoutEffect(() => {
    if (!activeSurface) {
      setPopoverLayout(null);
      return;
    }

    updatePopoverLayout();
    const frame = window.requestAnimationFrame(updatePopoverLayout);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePopoverLayout);
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current);
    if (popoverRef.current) resizeObserver?.observe(popoverRef.current);

    window.addEventListener("resize", updatePopoverLayout);
    document.addEventListener("scroll", updatePopoverLayout, true);
    window.visualViewport?.addEventListener("resize", updatePopoverLayout);
    window.visualViewport?.addEventListener("scroll", updatePopoverLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePopoverLayout);
      document.removeEventListener("scroll", updatePopoverLayout, true);
      window.visualViewport?.removeEventListener("resize", updatePopoverLayout);
      window.visualViewport?.removeEventListener("scroll", updatePopoverLayout);
    };
  }, [activeSurface, availableGroups, responseVersion?.versionCount, updatePopoverLayout]);

  useEffect(() => {
    if (!open && !correcting) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !popoverRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
        setCorrecting(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCorrecting(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [correcting, open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => itemRefs.current[0]?.focus());
    }
  }, [open]);

  const versions = responseVersion?.versions ?? [];
  const activeIndex = Math.max(
    0,
    versions.findIndex((version) => version.active)
  );
  const previousVersion = activeIndex > 0 ? versions[activeIndex - 1] : null;
  const nextVersion = activeIndex < versions.length - 1 ? versions[activeIndex + 1] : null;

  useEffect(() => {
    const root = rootRef.current;

    if (!root || !onPrefetchVersion || (!previousVersion && !nextVersion)) {
      return;
    }

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const prefetchAdjacentVersions = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => {
          if (previousVersion) void onPrefetchVersion(previousVersion.messageId);
          if (nextVersion) void onPrefetchVersion(nextVersion.messageId);
        }, { timeout: 500 });
        return;
      }

      timeoutHandle = window.setTimeout(() => {
        if (previousVersion) void onPrefetchVersion(previousVersion.messageId);
        if (nextVersion) void onPrefetchVersion(nextVersion.messageId);
      }, 80);
    };
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            prefetchAdjacentVersions();
          }
        }, { rootMargin: "120px" });

    if (observer) {
      observer.observe(root);
    } else {
      prefetchAdjacentVersions();
    }

    return () => {
      observer?.disconnect();
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [nextVersion, onPrefetchVersion, previousVersion]);

  if (!responseVersion) {
    return null;
  }

  async function runIntent(intent: InterviewRegenerationIntent) {
    setOpen(false);
    setLocalBusy(true);
    try {
      await onRegenerate(intent);
    } finally {
      setLocalBusy(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  async function submitCorrection() {
    const rawText = correction.trim();
    if (!rawText || correctionSubmitLockRef.current) return;
    correctionSubmitLockRef.current = true;
    setOpen(false);
    setCorrecting(false);
    setCorrection("");
    setLocalBusy(true);
    try {
      await onCorrectUnderstanding(rawText);
    } finally {
      correctionSubmitLockRef.current = false;
      setLocalBusy(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const enabledItems = itemRefs.current.filter(
      (item): item is HTMLButtonElement => Boolean(item && !item.disabled)
    );
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      enabledItems[(currentIndex + 1 + enabledItems.length) % enabledItems.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      enabledItems[(currentIndex - 1 + enabledItems.length) % enabledItems.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      enabledItems[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      enabledItems[enabledItems.length - 1].focus();
    }
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <span className="group relative inline-flex">
        <button
          ref={triggerRef}
          type="button"
          aria-label="换个问法"
          aria-describedby={tooltipId}
          aria-haspopup="menu"
          aria-expanded={Boolean(activeSurface)}
          aria-controls={activeSurface === "correction" ? `${menuId}-correction-panel` : menuId}
          disabled={disabled}
          title={disabled ? responseVersion.disabledReason ?? undefined : undefined}
          onClick={() => {
            if (open || correcting) {
              setOpen(false);
              setCorrecting(false);
              return;
            }
            setOpen(true);
          }}
          className="grid size-8 place-items-center rounded-[var(--radius-control)] text-[#806951] transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a57548] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RegenerateIcon />
        </button>
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-[#3f3329] px-2 py-1 text-[11px] leading-none text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          换个问法
        </span>
      </span>

      {responseVersion.versionCount > 1 ? (
        <div className="flex items-center gap-0.5 text-[13px] text-[#806951]" aria-label={`回复版本 ${activeIndex + 1} / ${versions.length}`}>
          <button
            type="button"
            aria-label="查看上一个回复版本"
            disabled={busy || localBusy || !responseVersion.canSwitch || activeIndex <= 0}
            title={!responseVersion.canSwitch ? responseVersion.disabledReason ?? undefined : undefined}
            onPointerDown={() => {
              if (previousVersion) void onPrefetchVersion?.(previousVersion.messageId);
            }}
            onPointerEnter={() => {
              if (previousVersion) void onPrefetchVersion?.(previousVersion.messageId);
            }}
            onFocus={() => {
              if (previousVersion) void onPrefetchVersion?.(previousVersion.messageId);
            }}
            onClick={() => {
              if (previousVersion) void onSwitchVersion(previousVersion.messageId);
            }}
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] transition active:scale-[0.97] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a57548] disabled:cursor-not-allowed disabled:opacity-30 [@media(pointer:coarse)]:size-11"
          >
            <ChevronLeftIcon />
          </button>
          <span className="min-w-10 text-center font-medium tabular-nums">
            {activeIndex + 1} / {versions.length}
          </span>
          <button
            type="button"
            aria-label="查看下一个回复版本"
            disabled={busy || localBusy || !responseVersion.canSwitch || activeIndex >= versions.length - 1}
            title={!responseVersion.canSwitch ? responseVersion.disabledReason ?? undefined : undefined}
            onPointerDown={() => {
              if (nextVersion) void onPrefetchVersion?.(nextVersion.messageId);
            }}
            onPointerEnter={() => {
              if (nextVersion) void onPrefetchVersion?.(nextVersion.messageId);
            }}
            onFocus={() => {
              if (nextVersion) void onPrefetchVersion?.(nextVersion.messageId);
            }}
            onClick={() => {
              if (nextVersion) void onSwitchVersion(nextVersion.messageId);
            }}
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] transition active:scale-[0.97] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a57548] disabled:cursor-not-allowed disabled:opacity-30 [@media(pointer:coarse)]:size-11"
          >
            <ChevronRightIcon />
          </button>
        </div>
      ) : null}

      {typeof document !== "undefined" && activeSurface
        ? createPortal(
          <motion.div
            key={activeSurface}
            ref={popoverRef}
            id={activeSurface === "menu" ? menuId : `${menuId}-correction-panel`}
            role={activeSurface === "menu" ? "menu" : "dialog"}
            aria-label={activeSurface === "menu" ? "选择换问法的方式" : "纠正理解"}
            aria-modal={activeSurface === "correction" ? false : undefined}
            data-placement={popoverLayout?.placement ?? "bottom"}
            onKeyDown={activeSurface === "menu" ? handleMenuKeyDown : undefined}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: activeSurface === "menu" ? -6 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0.1 } : { type: "spring", bounce: 0, duration: 0.28 }}
            style={{
              position: "fixed",
              top: popoverLayout?.top ?? POPOVER_MARGIN,
              left: popoverLayout?.left ?? POPOVER_MARGIN,
              width: popoverLayout?.width ?? (activeSurface === "correction" ? 384 : 352),
              maxHeight: popoverLayout?.maxHeight,
              visibility: popoverLayout ? "visible" : "hidden",
              transformOrigin: popoverLayout?.placement === "top" ? "bottom left" : "top left"
            }}
            className="interview-regeneration-popover z-[60] overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[rgba(255,250,242,0.96)] shadow-[0_18px_50px_rgba(72,48,28,0.2)] backdrop-blur-xl"
          >
            {activeSurface === "menu" ? (
              <div className="p-2">
          {responseVersion.versionCount >= 3 ? (
            <div>
              <p className="px-3 py-2 text-xs leading-5 text-[#765a40]">
                这个问题已经保留了三个版本。可以换个片段、整理当前内容或先停一下。
              </p>
              {[
                { id: "next_event" as const, label: "换个片段", disabled: false },
                { id: "generate_draft" as const, label: "整理当前内容", disabled: !canGenerateFromLimit },
                { id: "pause_session" as const, label: "先停一下", disabled: false }
              ].map((action, index) => (
                <button
                  key={action.id}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    setOpen(false);
                    void onLimitAction(action.id);
                  }}
                  className="block w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-medium text-[#4e3825] hover:bg-[rgba(198,154,104,0.12)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            availableGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-[0.08em] text-[#9a7653]">
                  {group.label}
                </p>
                {group.items.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role="menuitem"
                    onClick={() => void runIntent(item.id)}
                    className="block w-full rounded-[var(--radius-control)] px-3 py-2 text-left hover:bg-[rgba(198,154,104,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a57548]"
                  >
                    <span className="block text-sm font-medium text-[#4e3825]">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#806951]">{item.description}</span>
                  </button>
                ))}
              </div>
            ))
          )}
          <div className="mt-1 border-t border-[var(--line-soft)] pt-1">
            <button
              ref={(node) => {
                itemRefs.current[availableGroups[0]?.items.length ?? 0] = node;
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setCorrecting(true);
              }}
              className="block w-full rounded-[var(--radius-control)] px-3 py-2 text-left hover:bg-[rgba(198,154,104,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a57548]"
            >
              <span className="block text-sm font-medium text-[#4e3825]">纠正理解</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#806951]">告诉我哪个事实前提需要改正</span>
            </button>
          </div>
              </div>
            ) : (
              <div className="p-3">
                <label className="text-sm font-medium text-[#4e3825]" htmlFor={`${menuId}-correction`}>
                  哪个地方需要我重新理解？
                </label>
                <textarea
                  id={`${menuId}-correction`}
                  autoFocus
                  value={correction}
                  onChange={(event) => setCorrection(event.target.value)}
                  onCompositionStart={() => {
                    isCorrectionComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isCorrectionComposingRef.current = false;
                  }}
                  onKeyDown={(event) => {
                    const isComposing = isCorrectionComposingRef.current || event.nativeEvent.isComposing;

                    if (event.key !== "Enter" || event.shiftKey || isComposing) {
                      return;
                    }

                    event.preventDefault();
                    if (correction.trim() && !localBusy) {
                      void submitCorrection();
                    }
                  }}
                  rows={3}
                  maxLength={1200}
                  placeholder="例如：我刚才说的是同事帮了我，是这件事让我觉得被接住。"
                  className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/60 px-3 py-2 text-sm leading-6 text-[#4e3825] outline-none focus:border-[#a57548]"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCorrecting(false);
                      requestAnimationFrame(() => triggerRef.current?.focus());
                    }}
                    className="rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[#765a40] transition active:scale-[0.97] hover:bg-black/5"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={!correction.trim() || localBusy}
                    onClick={() => void submitCorrection()}
                    className="rounded-[var(--radius-control)] bg-[#d7b07b] px-3 py-1.5 text-xs font-semibold text-[#302317] transition active:scale-[0.97] disabled:opacity-40"
                  >
                    重新理解并继续
                  </button>
                </div>
              </div>
            )}
          </motion.div>,
          document.body
        )
        : null}
    </div>
  );
}
