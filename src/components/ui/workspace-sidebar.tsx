import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type WorkspaceSidebarProps = Omit<ComponentPropsWithoutRef<"aside">, "children"> & {
  collapsed?: boolean;
  width?: number | string;
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

type WorkspaceSidebarStyle = CSSProperties & {
  "--workspace-sidebar-width"?: string;
};

/**
 * 访谈、日记和认识自己共用的侧栏底座。交互逻辑由使用方控制，底座只统一尺寸与层级。
 */
export function WorkspaceSidebar({
  collapsed = false,
  width = 280,
  header,
  children,
  footer,
  className,
  style,
  ...rest
}: WorkspaceSidebarProps) {
  const resolvedWidth = typeof width === "number" ? `${width}px` : width;
  const sidebarStyle: WorkspaceSidebarStyle = {
    ...style,
    "--workspace-sidebar-width": resolvedWidth
  };

  return (
    <aside
      className={cn("ui-workspace-sidebar", className)}
      data-collapsed={collapsed || undefined}
      style={sidebarStyle}
      {...rest}
    >
      {header ? <div className="ui-workspace-sidebar__header">{header}</div> : null}
      <div className="ui-workspace-sidebar__body">{children}</div>
      {footer ? <div className="ui-workspace-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
