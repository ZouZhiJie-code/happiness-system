"use client";

import React, { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const reduceMotion = useReducedMotion();

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const menu = menuRef.current;
    const root = rootRef.current;
    if (menu && root) {
      const rootRect = root.getBoundingClientRect();
      const menuHeight = menu.getBoundingClientRect().height;
      setPlacement(rootRect.top >= menuHeight + 12 ? "top" : "bottom");
    }

    itemRefs.current[0]?.focus();
  }, [menuOpen]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const enabledItems = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
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
    <div ref={rootRef} className="relative" data-testid={testId}>
      <ActionButton
        ref={triggerRef}
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

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={menuAriaLabel}
            aria-orientation="vertical"
            onKeyDown={handleMenuKeyDown}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: placement === "top" ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: placement === "top" ? 6 : -6, scale: 0.97 }}
            transition={reduceMotion ? { duration: 0.1 } : { type: "spring", bounce: 0, duration: 0.28 }}
            className={cn(
              "ui-action-menu-panel absolute z-20",
              placement === "top" ? "bottom-[calc(100%+0.45rem)] origin-bottom" : "top-[calc(100%+0.45rem)] origin-top",
              align === "end" ? "right-0" : "left-0",
              surface === "calendar" && "ui-action-menu-panel--calendar"
            )}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={index === 0 ? 0 : -1}
                className="ui-action-menu-item"
                onClick={() => {
                  closeMenu(true);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
