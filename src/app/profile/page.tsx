import { StatusPill } from "@/components/shared/status-pill";
import { ProfileShell } from "@/components/profile/profile-shell";

export default function ProfilePage() {
  return (
    <div className="min-h-0 flex-1">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="relative z-10 grid min-h-0 gap-7 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <div className="max-w-[38rem]">
            <StatusPill label="用户画像" tone="warm" />
            <p className="archive-label mt-6">长期记忆</p>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.96] text-ink md:text-6xl">
              你留下的印记
            </h1>
            <p className="mt-4 text-pretty text-sm leading-8 text-ink/76">
              系统从访谈中提取出你的长期模式和偏好，也会记录你主动添加的画像条目。这些认知会在后续访谈中自然融入提问，不会被直接提及。
            </p>
          </div>
          <ProfileShell />
        </div>
      </section>
    </div>
  );
}
