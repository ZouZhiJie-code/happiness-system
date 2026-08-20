import Link from "next/link";
import type { ReactNode } from "react";

export interface SettingsPageViewProps {
  username: string;
  accountActions: ReactNode;
  internalTools?: ReactNode;
}

function SettingsSection({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[var(--line-soft)] py-7 first:border-t-0 first:pt-0">
      <h2 className="text-[20px] font-semibold leading-7 text-[var(--color-ink)]">{title}</h2>
      {description ? <p className="mt-2 max-w-[40rem] text-[15px] leading-7 text-[var(--color-muted)]">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SettingsPageView({ username, accountActions, internalTools }: SettingsPageViewProps) {
  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] flex-1 bg-[var(--color-canvas)] px-5 py-9 text-[var(--color-ink)] md:px-8 md:py-12 xl:px-10">
      <div className="mx-auto grid w-full max-w-[68rem] gap-9 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <header>
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--color-action)]">账户</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight text-[var(--color-ink)]">设置</h1>
          <p className="mt-3 text-[15px] leading-7 text-[var(--color-muted)]">管理账户、数据和隐私。</p>
        </header>

        <div className="rounded-[var(--radius-reading)] border border-[var(--line-soft)] bg-[var(--color-workspace)] px-5 py-7 md:px-8">
          <SettingsSection title="登录与安全">
            <dl className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
              <dt className="text-[13px] text-[var(--color-muted)]">用户名</dt>
              <dd className="text-[15px] font-medium text-[var(--color-ink)]">{username}</dd>
              <dt className="text-[13px] text-[var(--color-muted)]">登录方式</dt>
              <dd className="text-[15px] text-[var(--color-ink)]">用户名与密码</dd>
            </dl>
          </SettingsSection>

          <SettingsSection
            id="account"
            title="账户与数据"
            description="删除账号会清除与账户关联的个人记录，请在操作前确认。"
          >
            {accountActions}
          </SettingsSection>

          <SettingsSection title="隐私与协议" description="查看 Daily Light 如何保存和使用你的记录。">
            <nav aria-label="法律文档" className="flex flex-wrap gap-3">
              <Link
                href="/legal/privacy"
                className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 text-[15px] font-medium text-[var(--color-ink)] hover:border-[var(--color-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]"
              >
                隐私政策
              </Link>
              <Link
                href="/legal/terms"
                className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 text-[15px] font-medium text-[var(--color-ink)] hover:border-[var(--color-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]"
              >
                用户协议
              </Link>
            </nav>
          </SettingsSection>

          {internalTools ? <SettingsSection title="内部工具">{internalTools}</SettingsSection> : null}
        </div>
      </div>
    </main>
  );
}
