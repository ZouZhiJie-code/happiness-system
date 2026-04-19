import { InterviewShell } from "@/components/interview/interview-shell";
import { StatusPill } from "@/components/shared/status-pill";

export default function InterviewPage() {
  return (
    <div className="space-y-8">
      <section className="page-shell rounded-[38px] p-8 md:p-10">
        <StatusPill label="开心维度" tone="success" />
        <p className="archive-label mt-6">访谈桌面</p>
        <h1 className="mt-5 font-display text-5xl leading-[0.96] text-ink md:text-6xl">开心访谈工作台</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-ink/76 md:text-base">
          从一个具体事件开始，用几轮有边界的追问把开心的原因、分量和模式梳理清楚。右侧不是装饰，而是你这次访谈逐渐浮现出来的记录笔记。
        </p>
      </section>

      <InterviewShell />
    </div>
  );
}
