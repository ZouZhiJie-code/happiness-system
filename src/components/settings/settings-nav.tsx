"use client";

import { User, MessageSquare, Bell, Clock, Database } from "lucide-react";
import type { SettingsModule } from "@/features/settings/types";

interface SettingsNavProps {
  activeModule: SettingsModule;
  onModuleChange: (module: SettingsModule) => void;
}

const modules: { key: SettingsModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "个人资料", icon: User },
  { key: "interview", label: "访谈偏好", icon: MessageSquare },
  { key: "notification", label: "通知偏好", icon: Bell },
  { key: "reminder", label: "提醒设置", icon: Clock },
  { key: "data", label: "数据管理", icon: Database }
];

export function SettingsNav({ activeModule, onModuleChange }: SettingsNavProps) {
  return (
    <nav className="w-48 shrink-0 py-4">
      <div className="space-y-0.5">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.key}
              onClick={() => onModuleChange(mod.key)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                activeModule === mod.key
                  ? "border-l-2 border-[#a96f3d] font-medium text-[#302114]"
                  : "text-[#604529] hover:text-[#302114]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{mod.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
