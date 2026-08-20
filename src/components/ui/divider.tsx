import { cn } from "@/lib/utils";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** hairline 分隔线：只用于重复列表、表格或相邻操作区的明确边界。 */
export function Divider({ orientation = "horizontal", className }: DividerProps) {
  if (orientation === "vertical") {
    return <span aria-hidden className={cn("ui-hairline--vertical", className)} />;
  }
  return <hr className={cn("ui-hairline", className)} />;
}
