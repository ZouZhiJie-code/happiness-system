import { cn } from "@/lib/utils";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** hairline 分隔线：卡片内与底板上的标准分区手段。 */
export function Divider({ orientation = "horizontal", className }: DividerProps) {
  if (orientation === "vertical") {
    return <span aria-hidden className={cn("ui-hairline--vertical", className)} />;
  }
  return <hr className={cn("ui-hairline", className)} />;
}
