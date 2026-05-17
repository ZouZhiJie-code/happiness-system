import React from "react";
import { StatusPill } from "@/components/shared/status-pill";

const sections = [
  {
    title: "账号与使用",
    body:
      "你注册并登录后，可以在产品中创建、编辑、保存和删除自己的访谈记录、单维日志、当天整合日志与相关画像内容。你需要妥善保管自己的账号信息，并对账号下发生的操作负责。"
  },
  {
    title: "日志内容与使用边界",
    body:
      "你在产品中输入的日常经历、感受、判断和编辑后的日志内容，主要用于完成访谈、生成草稿、支持回看分析，以及提供与你本人相关的记录能力。请不要在产品中提交你无权处理的他人隐私信息。"
  },
  {
    title: "注销与服务调整",
    body:
      "你可以在后续开放的账户设置中申请注销账号。账号注销后，与你账号绑定的记录、日志、评分、记忆和画像数据会按系统规则一起删除。产品功能、页面文案和服务范围可能会持续调整，我们会在必要时更新本协议。"
  }
] as const;

export default function TermsPage() {
  return (
    <div className="min-h-0 flex-1">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-8">
          <div className="max-w-[40rem]">
            <StatusPill label="法律文档" tone="neutral" />
            <p className="archive-label mt-6">使用说明</p>
            <h1 className="mt-5 font-display text-5xl leading-[0.96] text-ink md:text-6xl">用户协议</h1>
            <p className="mt-4 text-sm leading-8 text-ink/76">
              这是一版用于首版账户体系上线的基础草稿，先覆盖账号归属、日志使用边界和注销删除等核心说明，后续可继续补充法务细节。
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

