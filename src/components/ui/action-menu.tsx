"use client";

import { Menu } from "@base-ui/react/menu";
import { useId, useState, type ReactNode } from "react";

import { actionButtonClass, type ActionButtonVariant } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

export type ActionMenuSurface = "default" | "calendar";

export type ActionMenuItem = {
  id: string;
  label: string;
  description?: string;
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
  triggerAriaLabel?: string;
  triggerClassName?: string;
  showDisclosure?: boolean;
};

/**
 * 全站动作菜单。方向键、Home、End、Esc、视口翻转和焦点恢复由 Base UI 统一处理。
 */
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
  testId = "action-menu",
  triggerAriaLabel,
  triggerClassName,
  showDisclosure = true
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuLabelId = useId();
  const unavailable = disabled || isBusy;

  return (
    <div className="relative" data-testid={testId}>
      <Menu.Root open={open} onOpenChange={setOpen} disabled={unavailable}>
        <Menu.Trigger
          className={actionButtonClass(variant, triggerClassName)}
          aria-label={triggerAriaLabel}
          title={disabled ? (disabledReason ?? undefined) : undefined}
        >
          {isBusy ? triggerBusyLabel : triggerLabel}
          {!isBusy && showDisclosure ? (
            <span aria-hidden="true" className="text-[13px] leading-none opacity-70">
              ▾
            </span>
          ) : null}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className="ui-action-menu-positioner"
            side="top"
            sideOffset={7}
            align={align}
            collisionPadding={12}
          >
            <Menu.Popup
              className={cn(
                "ui-action-menu-panel",
                surface === "calendar" && "ui-action-menu-panel--calendar"
              )}
              aria-labelledby={menuLabelId}
            >
              <span id={menuLabelId} className="sr-only">{menuAriaLabel}</span>
              {items.map((item) => (
                <Menu.Item
                  key={item.id}
                  className="ui-action-menu-item"
                  onClick={() => item.onSelect()}
                >
                  <span className="block font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="mt-0.5 block text-[13px] leading-5 text-[var(--text-dim)]">
                      {item.description}
                    </span>
                  ) : null}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
