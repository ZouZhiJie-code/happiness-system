"use client";

import { Field as BaseField } from "@base-ui/react/field";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FieldProps = Omit<ComponentPropsWithoutRef<typeof BaseField.Control>, "className"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  controlClassName?: string;
};

/**
 * 标准单行输入字段。标签、说明、错误和输入控件由同一个可访问字段语境关联。
 */
export function Field({
  label,
  description,
  error,
  className,
  controlClassName,
  ...controlProps
}: FieldProps) {
  return (
    <BaseField.Root className={cn("ui-field", className)} invalid={Boolean(error)}>
      <BaseField.Label className="ui-field__label">{label}</BaseField.Label>
      <BaseField.Control className={cn("ui-field__control", controlClassName)} {...controlProps} />
      {error ? (
        <BaseField.Error className="ui-field__error" match>
          {error}
        </BaseField.Error>
      ) : description ? (
        <BaseField.Description className="ui-field__description">{description}</BaseField.Description>
      ) : null}
    </BaseField.Root>
  );
}
