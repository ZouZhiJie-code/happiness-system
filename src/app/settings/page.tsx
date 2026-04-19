import { SettingsForm } from "@/components/joy/settings-form";
import { StatusPill } from "@/components/shared/status-pill";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <section className="page-shell rounded-[38px] p-8 md:p-10">
        <StatusPill label="访谈设置" tone="neutral" />
        <p className="archive-label mt-6">访谈偏好</p>
        <h1 className="mt-5 font-display text-5xl leading-[0.96] text-ink md:text-6xl">开始前，先确认这次记录方式</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-ink/76">
          这里只保留和本次开心记录直接相关的少量偏好，让你先确认系统会如何陪你完成这次访谈。
        </p>
      </section>

      <SettingsForm />
    </div>
  );
}
