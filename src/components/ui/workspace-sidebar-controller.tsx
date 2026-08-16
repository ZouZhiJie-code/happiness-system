"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";

import { GripVerticalIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "./workspace-sidebar-icons";

export const WORKSPACE_SIDEBAR_COLLAPSED_WIDTH = 64;
export const WORKSPACE_SIDEBAR_MIN_WIDTH = 240;
export const WORKSPACE_SIDEBAR_DEFAULT_WIDTH = 280;
export const WORKSPACE_SIDEBAR_MAX_WIDTH = 460;
export const WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD = 208;
export const WORKSPACE_SIDEBAR_KEYBOARD_STEP = 16;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type ResizeOrigin = {
  pointerId: number;
  x: number;
  visualWidth: number;
  expandedWidth: number;
  latestRawWidth: number;
};

export type WorkspaceSidebarControllerOptions = {
  collapsedStorageKey: string;
  widthStorageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
  collapseThreshold?: number;
  keyboardStep?: number;
};

export type WorkspaceSidebarController = {
  collapsed: boolean;
  width: number;
  expandedWidth: number;
  resizing: boolean;
  hydrated: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (next: boolean) => void;
  resetWidth: () => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  minWidth: number;
  maxWidth: number;
  collapsedWidth: number;
};

function clampExpandedWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, width));
}

export function useWorkspaceSidebarController({
  collapsedStorageKey,
  widthStorageKey,
  defaultWidth = WORKSPACE_SIDEBAR_DEFAULT_WIDTH,
  minWidth = WORKSPACE_SIDEBAR_MIN_WIDTH,
  maxWidth = WORKSPACE_SIDEBAR_MAX_WIDTH,
  collapsedWidth = WORKSPACE_SIDEBAR_COLLAPSED_WIDTH,
  collapseThreshold = WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD,
  keyboardStep = WORKSPACE_SIDEBAR_KEYBOARD_STEP
}: WorkspaceSidebarControllerOptions): WorkspaceSidebarController {
  const [storedCollapsed, setStoredCollapsed] = useState(false);
  const [expandedWidth, setExpandedWidth] = useState(defaultWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const resizeOriginRef = useRef<ResizeOrigin | null>(null);

  useIsomorphicLayoutEffect(() => {
    const savedCollapsed = window.localStorage.getItem(collapsedStorageKey) === "true";
    const savedWidth = Number(window.localStorage.getItem(widthStorageKey));
    setStoredCollapsed(savedCollapsed);
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      setExpandedWidth(clampExpandedWidth(savedWidth, minWidth, maxWidth));
    }
    setHydrated(true);
  }, [collapsedStorageKey, maxWidth, minWidth, widthStorageKey]);

  const persistCollapsed = (next: boolean) => {
    setStoredCollapsed(next);
    window.localStorage.setItem(collapsedStorageKey, String(next));
  };

  const persistWidth = (nextWidth: number) => {
    const next = clampExpandedWidth(nextWidth, minWidth, maxWidth);
    setExpandedWidth(next);
    window.localStorage.setItem(widthStorageKey, String(next));
    return next;
  };

  const effectiveCollapsed = dragWidth === null ? storedCollapsed : dragWidth < collapseThreshold;
  const effectiveWidth = dragWidth === null
    ? storedCollapsed
      ? collapsedWidth
      : expandedWidth
    : effectiveCollapsed
      ? Math.max(collapsedWidth, Math.min(collapseThreshold, dragWidth))
      : Math.max(minWidth, Math.min(maxWidth, dragWidth));

  const setCollapsed = (next: boolean) => {
    setDragWidth(null);
    persistCollapsed(next);
  };

  const toggleCollapsed = () => setCollapsed(!storedCollapsed);

  const resetWidth = () => {
    setDragWidth(null);
    persistWidth(defaultWidth);
    persistCollapsed(false);
  };

  const onResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      if (storedCollapsed) return;
      persistWidth(minWidth);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      persistWidth(maxWidth);
      persistCollapsed(false);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (storedCollapsed) {
        persistCollapsed(false);
      } else {
        persistWidth(expandedWidth + keyboardStep);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!storedCollapsed) persistWidth(expandedWidth - keyboardStep);
    }
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const visualWidth = storedCollapsed ? collapsedWidth : expandedWidth;
    resizeOriginRef.current = {
      pointerId: event.pointerId,
      x: clientX,
      visualWidth,
      expandedWidth,
      latestRawWidth: visualWidth
    };
    setDragWidth(visualWidth);
    setResizing(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = resizeOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId || !Number.isFinite(event.clientX)) return;
    const rawWidth = origin.visualWidth + event.clientX - origin.x;
    origin.latestRawWidth = rawWidth;
    setDragWidth(Math.max(collapsedWidth, Math.min(maxWidth, rawWidth)));
  };

  const finishPointerResize = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const origin = resizeOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    resizeOriginRef.current = null;
    setResizing(false);
    setDragWidth(null);

    if (cancelled) {
      setExpandedWidth(origin.expandedWidth);
    } else if (origin.latestRawWidth < collapseThreshold) {
      setExpandedWidth(origin.expandedWidth);
      persistCollapsed(true);
    } else {
      persistWidth(origin.latestRawWidth);
      persistCollapsed(false);
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  return {
    collapsed: effectiveCollapsed,
    width: effectiveWidth,
    expandedWidth,
    resizing,
    hydrated,
    toggleCollapsed,
    setCollapsed,
    resetWidth,
    onResizeKeyDown,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp: (event) => finishPointerResize(event, false),
    onResizePointerCancel: (event) => finishPointerResize(event, true),
    minWidth,
    maxWidth,
    collapsedWidth
  };
}

export function WorkspaceSidebarBoundaryControls({
  controller,
  controlsId,
  expandLabel,
  collapseLabel,
  resizeLabel
}: {
  controller: WorkspaceSidebarController;
  controlsId: string;
  expandLabel: string;
  collapseLabel: string;
  resizeLabel: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={controller.toggleCollapsed}
        aria-label={controller.collapsed ? expandLabel : collapseLabel}
        aria-expanded={!controller.collapsed}
        aria-controls={controlsId}
        className="group absolute -right-[1.375rem] top-3 z-20 grid size-11 place-items-center rounded-full bg-transparent text-[var(--text-dim)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]"
      >
        <span className="grid size-7 place-items-center rounded-full border border-[var(--workspace-sidebar-border)] bg-[var(--workspace-sidebar)] opacity-65 transition-[opacity,background-color] duration-150 group-hover:bg-[var(--workspace-sidebar-hover)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
          {controller.collapsed
            ? <PanelLeftOpenIcon className="size-3.5" />
            : <PanelLeftCloseIcon className="size-3.5" />}
        </span>
      </button>
      <div
        role="separator"
        aria-label={resizeLabel}
        aria-orientation="vertical"
        aria-valuemin={controller.collapsedWidth}
        aria-valuemax={controller.maxWidth}
        aria-valuenow={Math.round(controller.width)}
        tabIndex={0}
        title="拖动调整侧栏宽度；向内拖动可收起，收起后向外拖动可展开；双击恢复默认宽度"
        className="group absolute inset-y-0 -right-4 z-10 flex w-8 touch-none cursor-col-resize items-center justify-center outline-none focus-visible:bg-[var(--workspace-sidebar-hover)]/45"
        onDoubleClick={controller.resetWidth}
        onKeyDown={controller.onResizeKeyDown}
        onPointerDown={controller.onResizePointerDown}
        onPointerMove={controller.onResizePointerMove}
        onPointerUp={controller.onResizePointerUp}
        onPointerCancel={controller.onResizePointerCancel}
      >
        <span className="grid h-12 w-2 place-items-center rounded-full text-[var(--text-dim)] opacity-0 transition-opacity group-hover:opacity-75 group-focus-visible:opacity-100">
          <GripVerticalIcon className="size-3.5" />
        </span>
      </div>
    </>
  );
}
