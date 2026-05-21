import React from "react";

import { SettingsAccountPanel } from "@/components/auth/settings-account-panel";
import { SettingsForm } from "@/components/joy/settings-form";
import { StatusPill } from "@/components/shared/status-pill";
import { isAdminUsername } from "@/server/services/auth/admin-access";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function SettingsPage() {
  const user = await requireAuthenticatedPage("/settings");

  return (
    <div className="min-h-0 flex-1">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="relative z-10 grid min-h-0 gap-7 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <div className="max-w-[38rem]">
            <StatusPill label="访谈设置" tone="neutral" />
            <p className="archive-label mt-6">访谈偏好</p>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.96] text-ink md:text-6xl">
              开始前，先确认这次记录方式
            </h1>
            <p className="mt-4 text-pretty text-sm leading-8 text-ink/76">
              这里只保留和本次日志访谈直接相关的少量偏好，让你先确认系统会如何陪你完成这次记录。
            </p>
          </div>

          <div className="grid gap-4">
            <SettingsForm />
            <SettingsAccountPanel
              user={user}
              showAdminAnalyticsEntry={Boolean(user?.username && isAdminUsername(user.username))}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
