import Link from "next/link";

type SessionUser = {
  id: string;
  username: string;
} | null;

interface SettingsAccountPanelProps {
  user: SessionUser;
  showAdminAnalyticsEntry?: boolean;
  showAdminAIQualityEntry?: boolean;
  showAdminAIRuntimeEntry?: boolean;
}

const internalLinkClass =
  "inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 text-[15px] font-medium text-[var(--color-ink)] hover:border-[var(--color-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]";

export function SettingsAccountPanel({
  showAdminAnalyticsEntry = false,
  showAdminAIQualityEntry = false,
  showAdminAIRuntimeEntry = false
}: SettingsAccountPanelProps) {
  return (
    <nav aria-label="内部工具" className="flex flex-wrap gap-3">
      {showAdminAIRuntimeEntry ? <Link href="/settings/ai-runtime" className={internalLinkClass}>AI 运行配置</Link> : null}
      {showAdminAnalyticsEntry ? <Link href="/admin/analytics" className={internalLinkClass}>数据分析</Link> : null}
      {showAdminAIQualityEntry ? <Link href="/admin/ai-quality" className={internalLinkClass}>AI 质量改进</Link> : null}
    </nav>
  );
}
