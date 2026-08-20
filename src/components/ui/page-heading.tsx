import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeadingProps = Omit<ComponentPropsWithoutRef<"header">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** 工作台默认 ui；日记与报告标题显式选择 display。 */
  font?: "ui" | "display";
  headingAs?: "h1" | "h2";
};

/** 页面唯一主标题：小桌面 28px，大桌面 32px。 */
export function PageHeading({
  title,
  description,
  actions,
  font = "ui",
  headingAs = "h1",
  className,
  ...rest
}: PageHeadingProps) {
  const Heading = headingAs;

  return (
    <header className={cn("ui-page-heading", className)} {...rest}>
      <div className="min-w-0">
        <Heading className="ui-page-heading__title" data-font={font}>
          {title}
        </Heading>
        {description ? <p className="ui-page-heading__description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-heading__actions">{actions}</div> : null}
    </header>
  );
}

export type { PageHeadingProps };
