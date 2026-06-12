"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode
} from "react";

import { cn } from "@/lib/utils";

export type SegmentedControlVariant = "soft" | "calendar" | "admin" | "underline";

export interface SegmentedControlItem<T extends string> {
  value: T;
  label: ReactNode;
  adornment?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  buttonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "children">;
}

interface SlidingSegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: SegmentedControlItem<T>[];
  ariaLabel: string;
  variant?: SegmentedControlVariant;
  className?: string;
  scrollable?: boolean;
  highlightSelection?: boolean;
}

const VARIANT_CLASS: Record<SegmentedControlVariant, string> = {
  soft: "ui-segmented-control ui-segmented-control--soft",
  calendar: "ui-segmented-control ui-segmented-control--calendar",
  admin: "ui-segmented-control ui-segmented-control--admin",
  underline: "ui-segmented-control ui-segmented-control--underline"
};

export function SlidingSegmentedControl<T extends string>({
  value,
  onChange,
  items,
  ariaLabel,
  variant = "soft",
  className,
  scrollable = false,
  highlightSelection = true
}: SlidingSegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>());
  const [thumbStyle, setThumbStyle] = useState<{ width: number; transform: string } | null>(null);

  const repositionThumb = useCallback(() => {
    const container = scrollRef.current ?? containerRef.current;
    const activeButton = buttonRefs.current.get(value);

    if (!container || !activeButton) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const x = buttonRect.left - containerRect.left + (scrollRef.current?.scrollLeft ?? 0);

    const nextThumbStyle = {
      width: buttonRect.width,
      transform: `translateX(${x}px)`
    };

    setThumbStyle(nextThumbStyle);
  }, [value]);

  useLayoutEffect(() => {
    repositionThumb();
  }, [repositionThumb, items, value]);

  useEffect(() => {
    const container = scrollRef.current ?? containerRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      repositionThumb();
    });

    observer.observe(container);
    buttonRefs.current.forEach((button) => {
      observer.observe(button);
    });

    const scrollContainer = scrollRef.current;
    const handleScroll = () => repositionThumb();
    scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
  }, [repositionThumb, items, value]);

  const isUnderline = variant === "underline";

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "ui-segmented-control__thumb",
          isUnderline && "ui-segmented-control__thumb--underline",
          !highlightSelection && "ui-segmented-control__thumb--hidden"
        )}
        style={
          highlightSelection && thumbStyle
            ? {
                width: thumbStyle.width,
                transform: thumbStyle.transform
              }
            : undefined
        }
      />
      {items.map((item) => {
        const isActive = highlightSelection && item.value === value;
        const { className: itemButtonClassName, ...restButtonProps } = item.buttonProps ?? {};

        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) {
                buttonRefs.current.set(item.value, node);
              } else {
                buttonRefs.current.delete(item.value);
              }
            }}
            type="button"
            disabled={item.disabled}
            aria-label={item.ariaLabel}
            aria-pressed={isActive}
            aria-current={isActive ? "true" : undefined}
            data-active={isActive ? "true" : "false"}
            onClick={() => onChange(item.value)}
            className={cn(
              "ui-segmented-control__button",
              isActive && "ui-segmented-control__button--active",
              itemButtonClassName
            )}
            {...restButtonProps}
          >
            <span className="ui-segmented-control__label">{item.label}</span>
            {item.adornment ? <span className="ui-segmented-control__adornment">{item.adornment}</span> : null}
          </button>
        );
      })}
    </>
  );

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn(VARIANT_CLASS[variant], scrollable && "ui-segmented-control--scrollable", className)}
    >
      {scrollable ? (
        <div ref={scrollRef} className="ui-segmented-control__scroll">
          {inner}
        </div>
      ) : (
        inner
      )}
    </div>
  );
}
