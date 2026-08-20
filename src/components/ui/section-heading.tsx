import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: ReactNode;
  /** 标题右侧的轻提示文字 */
  hint?: ReactNode;
  /** 标题下方的一句说明 */
  description?: ReactNode;
  /** 行尾动作区（按钮 / 链接 / chip） */
  actions?: ReactNode;
  /** section 为 20px 分区标题，item 为 16px 条目标题 */
  size?: "section" | "item";
  /** 按页面语义选择 h2 / h3 / h4，视觉层级由 size 控制 */
  headingAs?: "h2" | "h3" | "h4";
  className?: string;
}

/**
 * 内容分区标题：使用字号、字重和留白建立层级，不自动附加装饰线。
 */
export function SectionHeading({
  title,
  hint,
  description,
  actions,
  size = "section",
  headingAs = "h2",
  className
}: SectionHeadingProps) {
  const Heading = headingAs as ElementType;

  return (
    <div className={cn("ui-section-heading", className)} data-size={size}>
      <div className="min-w-0">
        <div className="ui-section-heading__line">
          <Heading className="ui-section-heading__title">{title}</Heading>
          {hint ? <span className="ui-section-heading__hint">{hint}</span> : null}
        </div>
        {description ? <p className="ui-section-heading__description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-section-heading__actions">{actions}</div> : null}
    </div>
  );
}
