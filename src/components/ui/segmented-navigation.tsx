"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export type SegmentedNavigationItem<Value extends string = string> = {
  value: Value;
  label: string;
  href: string;
};

export function SegmentedNavigation<Value extends string>({
  items,
  value,
  ariaLabel,
  className
}: {
  items: Array<SegmentedNavigationItem<Value>>;
  value: Value;
  ariaLabel: string;
  className?: string;
}) {
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const moveFocus = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <nav aria-label={ariaLabel} className={cn("ui-segmented-navigation", className)}>
      {items.map((item, index) => (
        <Link
          key={item.value}
          ref={(node) => { itemRefs.current[index] = node; }}
          href={item.href}
          aria-current={value === item.value ? "page" : undefined}
          onKeyDown={(event) => moveFocus(event, index)}
          className="ui-segmented-navigation__item"
          data-active={value === item.value || undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
