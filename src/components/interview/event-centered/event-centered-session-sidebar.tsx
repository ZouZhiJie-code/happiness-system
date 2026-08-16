"use client";

import { useMemo, useRef } from "react";

import {
  WorkspaceSidebarBoundaryControls,
  useWorkspaceSidebarController
} from "@/components/ui";
import { formatEntryDate, getTodayEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import type {
  EventCenteredSessionLifecycle,
  EventCenteredSessionListItem
} from "@/types/event-centered-interview";

const SIDEBAR_STORAGE_KEY = "daily-light:interview-sidebar-collapsed";
const SIDEBAR_WIDTH_STORAGE_KEY = "daily-light:interview-sidebar-width";
function lifecycleLabel(lifecycle: EventCenteredSessionLifecycle) {
  if (lifecycle === "completed") return "已完成";
  if (lifecycle === "abandoned") return "已结束";
  if (lifecycle === "blank") return "待开始";
  return "进行中";
}

function groupLabel(entryDate: string, today: string, yesterday: string) {
  if (entryDate === today) return "今天";
  if (entryDate === yesterday) return "昨天";
  const [year, month, day] = entryDate.split("-");
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

function activityTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function EventCenteredSessionSidebar({
  items,
  activeSessionId,
  unfinishedCount,
  unfinishedLimit,
  busy,
  onNew,
  onLimitReached,
  onSelect
}: {
  items: EventCenteredSessionListItem[];
  activeSessionId: string | null;
  unfinishedCount: number;
  unfinishedLimit: number;
  busy: boolean;
  onNew: () => void;
  onLimitReached?: () => void;
  onSelect: (rootSessionId: string) => void;
}) {
  const sidebar = useWorkspaceSidebarController({
    collapsedStorageKey: SIDEBAR_STORAGE_KEY,
    widthStorageKey: SIDEBAR_WIDTH_STORAGE_KEY
  });
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const today = getTodayEntryDate();
  const yesterday = formatEntryDate(new Date(parseEntryDateInput(today).getTime() - 24 * 60 * 60 * 1000));
  const atLimit = unfinishedCount >= unfinishedLimit;

  const groups = useMemo(() => {
    const ordered = new Map<string, EventCenteredSessionListItem[]>();
    for (const item of items) {
      const label = groupLabel(item.entryDate, today, yesterday);
      ordered.set(label, [...(ordered.get(label) ?? []), item]);
    }
    return Array.from(ordered.entries());
  }, [items, today, yesterday]);

  const selectableIds = items.map((item) => item.rootSessionId);
  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % selectableIds.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + selectableIds.length) % selectableIds.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = selectableIds.length - 1;
    if (nextIndex === null || selectableIds.length === 0) return;
    event.preventDefault();
    const id = selectableIds[nextIndex];
    itemRefs.current[id]?.focus();
    onSelect(id);
  };

  return (
    <aside
      id="event-centered-session-sidebar"
      aria-label="记录列表"
      data-collapsed={sidebar.collapsed ? "true" : "false"}
      data-resizing={sidebar.resizing ? "true" : "false"}
      data-hydrated={sidebar.hydrated ? "true" : "false"}
      style={{ width: sidebar.width }}
      className={`relative flex min-h-0 shrink-0 flex-col border-r border-[var(--workspace-sidebar-border)] bg-[var(--workspace-sidebar)] px-2.5 py-3 ${sidebar.hydrated && !sidebar.resizing ? "transition-[width] duration-150 motion-reduce:transition-none" : ""}`}
    >
      <WorkspaceSidebarBoundaryControls
        controller={sidebar}
        controlsId="event-centered-session-sidebar"
        expandLabel="展开记录侧栏"
        collapseLabel="收起记录侧栏"
        resizeLabel="调整记录侧栏宽度"
      />

      <div className={sidebar.collapsed ? "shrink-0" : "shrink-0 pr-3"}>
        <button
          type="button"
          onClick={() => {
            if (atLimit) {
              onLimitReached?.();
              return;
            }
            onNew();
          }}
          disabled={busy}
          aria-disabled={atLimit || undefined}
          title={atLimit ? `最多同时保留 ${unfinishedLimit} 条未完成记录，请先完成其中一条。` : "新建记录"}
          className={sidebar.collapsed
            ? "grid size-11 place-items-center rounded-[var(--radius-control)] bg-[var(--paper-deep)] text-lg text-[var(--paper-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] disabled:opacity-45"
            : `flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--paper-deep)] px-4 text-sm font-semibold text-[var(--paper-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] disabled:opacity-45 ${atLimit ? "opacity-70" : ""}`}
          aria-label="新建记录"
        >
          {sidebar.collapsed ? "+" : "新建记录"}
        </button>
      </div>

      {sidebar.collapsed ? (
        <div className="panel-scroll mt-4 grid min-h-0 gap-2 overflow-y-auto" role="listbox" aria-label="会话列表">
          {items.map((item, index) => (
            <button
              key={item.rootSessionId}
              ref={(node) => { itemRefs.current[item.rootSessionId] = node; }}
              type="button"
              role="option"
              aria-selected={item.rootSessionId === activeSessionId}
              aria-label={`${item.title}，${lifecycleLabel(item.lifecycle)}`}
              title={`${activityTime(item.lastActivityAt)} · ${item.title}`}
              disabled={busy}
              onClick={() => onSelect(item.rootSessionId)}
              onKeyDown={(event) => moveFocus(event, index)}
              className={item.rootSessionId === activeSessionId
                ? "grid size-11 place-items-center rounded-[var(--radius-control)] bg-[var(--workspace-sidebar-selected)] text-xs font-semibold text-ink"
                : "grid size-11 place-items-center rounded-[var(--radius-control)] text-xs text-[var(--text-dim)] hover:bg-[var(--workspace-sidebar-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"}
            >
              {Array.from(item.title.trim() || "记")[0]}
            </button>
          ))}
        </div>
      ) : (
        <div className="panel-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-1" role="listbox" aria-label="会话列表">
          {groups.map(([label, groupItems]) => (
            <section key={label} className="mb-5" aria-label={label}>
              <h2 className="px-2 text-xs font-medium text-[var(--text-dim)]">{label}</h2>
              <div className="mt-2 grid gap-1">
                {groupItems.map((item) => {
                  const index = selectableIds.indexOf(item.rootSessionId);
                  return (
                    <button
                      key={item.rootSessionId}
                      ref={(node) => { itemRefs.current[item.rootSessionId] = node; }}
                      type="button"
                      role="option"
                      aria-selected={item.rootSessionId === activeSessionId}
                      disabled={busy}
                      onClick={() => onSelect(item.rootSessionId)}
                      onKeyDown={(event) => moveFocus(event, index)}
                      className={item.rootSessionId === activeSessionId
                        ? "grid min-h-14 grid-cols-[3.4rem_minmax(0,1fr)] items-center rounded-[var(--radius-control)] bg-[var(--workspace-sidebar-selected)] px-2.5 py-2 text-left"
                        : "grid min-h-14 grid-cols-[3.4rem_minmax(0,1fr)] items-center rounded-[var(--radius-control)] px-2.5 py-2 text-left hover:bg-[var(--workspace-sidebar-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"}
                    >
                      <time className="text-xs tabular-nums text-[var(--text-dim)]">{activityTime(item.lastActivityAt)}</time>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-[var(--text-dim)]">{lifecycleLabel(item.lifecycle)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {items.length === 0 ? (
            <p className="px-2 py-6 text-sm leading-6 text-[var(--text-dim)]">从一条新记录开始。</p>
          ) : null}
        </div>
      )}

      {!sidebar.collapsed ? (
        <p className="mt-3 px-2 text-xs text-[var(--text-dim)]">
          未完成 {unfinishedCount} / {unfinishedLimit}
        </p>
      ) : null}

    </aside>
  );
}
