"use client";

import { useState } from "react";
import type { SettingsModule } from "@/features/settings/types";
import { SettingsNav } from "./settings-nav";
import { SettingsContent } from "./settings-content";
import { ProfileForm } from "./profile-form";
import { InterviewForm } from "./interview-form";
import { DataManagement } from "./data-management";
import { NotificationForm } from "./notification-form";
import { ReminderForm } from "./reminder-form";

export function SettingsLayout() {
  const [activeModule, setActiveModule] = useState<SettingsModule>("profile");

  const renderModuleContent = () => {
    switch (activeModule) {
      case "profile":
        return <ProfileForm />;
      case "interview":
        return <InterviewForm />;
      case "notification":
        return <NotificationForm />;
      case "reminder":
        return <ReminderForm />;
      case "data":
        return <DataManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-var(--site-header-viewport-offset))] bg-[#f8e9cc] px-6 py-5">
      {/* 左侧导航 */}
      <SettingsNav activeModule={activeModule} onModuleChange={setActiveModule} />

      {/* 分隔线 */}
      <div className="w-px bg-[rgba(96,69,41,0.12)]" />

      {/* 右侧内容区 */}
      <div className="flex-1 pl-6">
        <SettingsContent activeModule={activeModule}>{renderModuleContent()}</SettingsContent>
      </div>
    </div>
  );
}
