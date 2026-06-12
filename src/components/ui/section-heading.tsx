import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  /** 标题右侧的轻提示文字 */
  hint?: string;
  /** 标题下方的一句说明 */
  description?: string;
  /** 行尾动作区（按钮 / 链接 / chip） */
  actions?: ReactNode;
  className?: string;
}

/**
 * 眉题式分组标题：替代"再包一层卡片"的信息分组方式。
 */
export function SectionHeading({ title, hint, description, actions, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", className)}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-[#46331f]">{title}</h3>
          {hint ? <span className="text-xs text-[var(--text-faint)]">{hint}</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-xs leading-5 text-[var(--text-dim)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
