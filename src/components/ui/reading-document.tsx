import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ReadingSurface } from "./reading-surface";

export type ReadingDocumentProps = {
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sources?: ReactNode;
  footer?: ReactNode;
  density?: "comfortable" | "compact";
  headingAs?: "h1" | "h2";
  ariaLabel?: string;
  className?: string;
};

/** 日记、周记和月记共用的阅读结构。 */
export function ReadingDocument({
  title,
  meta,
  status,
  actions,
  children,
  sources,
  footer,
  density = "comfortable",
  headingAs = "h1",
  ariaLabel,
  className
}: ReadingDocumentProps) {
  const Heading = headingAs;

  return (
    <ReadingSurface className={cn("ui-reading-document", className)} density={density} aria-label={ariaLabel}>
      <header className="ui-reading-document__header">
        <div className="min-w-0">
          {meta ? <div className="ui-reading-document__meta">{meta}</div> : null}
          <div className="ui-reading-document__title-row">
            <Heading className="ui-reading-document__title">{title}</Heading>
            {status ? <div className="ui-reading-document__status">{status}</div> : null}
          </div>
        </div>
        {actions ? <div className="ui-reading-document__actions">{actions}</div> : null}
      </header>
      <div className="ui-reading-document__body">{children}</div>
      {sources ? <div className="ui-reading-document__sources">{sources}</div> : null}
      {footer ? <footer className="ui-reading-document__footer">{footer}</footer> : null}
    </ReadingSurface>
  );
}
