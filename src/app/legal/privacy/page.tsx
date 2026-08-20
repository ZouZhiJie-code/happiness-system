import React from "react";

import { LegalPageView } from "@/app/legal/legal-page-view";

const sections = [
  {
    title: "保存哪些内容",
    body:
      "我们会保存你主动提交的用户名、访谈内容、记录卡、日记、评分、画像和记忆，以及维持登录、保存和恢复功能所需的技术信息。"
  },
  {
    title: "怎样使用这些内容",
    body:
      "你的内容用于继续访谈、整理日记、恢复未完成记录和提供回看。需要 AI 处理时，系统会把完成当前功能所需的文字发送给对应服务。"
  },
  {
    title: "反馈与质量改进",
    body:
      "你提交点赞、点踩或文字反馈时，系统会把反馈与对应回复关联，用于查找生成问题。可以修改或撤回的反馈，以页面实际提供的操作为准。"
  },
  {
    title: "删除账号和数据",
    body:
      "你可以在“设置”中删除账号。确认删除后，与账号关联的访谈记录、日记、评分、画像、记忆和登录会话会一起删除。这个操作完成后无法恢复。"
  }
] as const;

export default function PrivacyPage() {
  return (
    <LegalPageView
      title="隐私政策"
      updatedAt="2026年8月13日"
      lead="这份说明介绍 Daily Light 会保存哪些信息、怎样使用这些信息，以及你如何删除账号和个人数据。"
      sections={sections}
    />
  );
}
