"use client";

import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { ActionButton, type ActionButtonVariant } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

export type ActionMenuSurface = "default" | "calendar";

export type ActionMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
};

type ActionMenuProps = {
  triggerLabel: ReactNode;
  triggerBusyLabel?: string;
  isBusy?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  menuAriaLabel: string;
  items: ActionMenuItem[];
  variant?: ActionButtonVariant;
  surface?: ActionMenuSurface;
  align?: "start" | "end";
  testId?: string;
};

export function ActionMenu({
  triggerLabel,
  triggerBusyLabel = "处理中...",
  isBusy = false,
  disabled = false,
  disabledReason,
  menuAriaLabel,
  items,
  variant = "secondary",
  surface = "default",
  align = "end",
  testId = "action-menu"
}: ActionMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative" data-testid={testId}>
      <ActionButton
        type="button"
        variant={variant}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        disabled={disabled || isBusy}
        title={disabled ? (disabledReason ?? undefined) : undefined}
        onClick={() => {
          if (disabled || isBusy) {
            return;
          }

          setMenuOpen((current) => !current);
        }}
      >
        {isBusy ? triggerBusyLabel : triggerLabel}
        {!isBusy ? (
          <span aria-hidden="true" className="text-[0.68rem] leading-none opacity-70">
            ▾
          </span>
        ) : null}
      </ActionButton>

      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={menuAriaLabel}
          className={cn(
            "ui-action-menu-panel absolute z-20 bottom-[calc(100%+0.45rem)]",
            align === "end" ? "right-0" : "left-0",
            surface === "calendar" && "ui-action-menu-panel--calendar"
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="ui-action-menu-item"
              onClick={() => {
                setMenuOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
