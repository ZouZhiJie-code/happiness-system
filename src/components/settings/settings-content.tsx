"use client";

import type { SettingsModule } from "@/features/settings/types";

interface SettingsContentProps {
  activeModule: SettingsModule;
  children?: React.ReactNode;
}

const moduleTitles: Record<SettingsModule, string> = {
  profile: "个人资料",
  interview: "访谈偏好",
  notification: "通知偏好",
  reminder: "提醒设置",
  data: "数据管理"
};

export function SettingsContent({ activeModule, children }: SettingsContentProps) {
  return (
    <main className="flex-1 overflow-y-auto py-4">
      <h1 className="font-display text-xl text-[#302114]">
        {moduleTitles[activeModule]}
      </h1>

      <div className="mt-6">
        {children}
      </div>
    </main>
  );
}
