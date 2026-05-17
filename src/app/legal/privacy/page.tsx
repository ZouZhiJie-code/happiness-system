import React from "react";
import { StatusPill } from "@/components/shared/status-pill";

const sections = [
  {
    title: "我们会收集哪些信息",
    body:
      "当你使用账户体系和日志产品时，我们会保存你主动提供的账号信息、访谈消息、日志正文、评分、画像编辑内容，以及支撑这些功能所需的基础技术数据。"
  },
  {
    title: "AI 处理与第三方服务",
    body:
      "为了完成访谈理解、草稿生成和画像整理，系统会将必要的文本内容发送给 AI 服务进行处理。我们会尽量按功能所需最小范围使用这些内容，并持续优化内部隔离与错误处理。"
  },
  {
    title: "保存、删除与联系",
    body:
      "你的数据会与账号绑定，用于后续回看、继续编辑、日历与分析展示。后续开放账号注销后，相关记录会按系统规则一起删除。如果本政策发生重要更新，我们会在产品内同步最新版本。"
  }
] as const;

export default function PrivacyPage() {
  return (
    <div className="min-h-0 flex-1">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-8">
          <div className="max-w-[40rem]">
            <StatusPill label="法律文档" tone="neutral" />
            <p className="archive-label mt-6">隐私说明</p>
            <h1 className="mt-5 font-display text-5xl leading-[0.96] text-ink md:text-6xl">隐私政策</h1>
            <p className="mt-4 text-sm leading-8 text-ink/76">
              这是一版配合首版账户体系使用的基础隐私草稿，先明确账号绑定、AI 处理、保存与删除等核心事实，后续再补充更完整的法务文本。
            </p>
          </div>

          <div className="grid gap-4">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[22px] border border-[rgba(132,96,62,0.12)] bg-[rgba(255,250,243,0.76)] px-5 py-5 shadow-[0_14px_32px_rgba(95,63,33,0.05)]"
              >
                <h2 className="font-display text-2xl leading-tight text-ink">{section.title}</h2>
                <p className="mt-3 text-sm leading-8 text-ink/76">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

