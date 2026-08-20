import React from "react";

import { LegalPageView } from "@/app/legal/legal-page-view";

const sections = [
  {
    title: "账户与使用",
    body:
      "注册并登录后，你可以创建访谈记录、记录卡和日记，并查看与账号关联的内容。请妥善保管用户名和密码，并对账号中的操作负责。"
  },
  {
    title: "你提交的内容",
    body:
      "你可以记录自己的经历、感受和判断，也可以编辑生成后的日记。请尊重他人的隐私，不要提交自己无权处理的信息。"
  },
  {
    title: "AI 生成内容",
    body:
      "访谈回复和日记草稿可能由 AI 协助生成。请在保存和使用前阅读并确认内容；健康、法律和财务等重要决定仍需要咨询相应专业人士。"
  },
  {
    title: "删除账号",
    body:
      "你可以随时在“设置”中删除账号。确认删除后，与账号关联的个人内容会一起删除，操作完成后无法恢复。"
  },
  {
    title: "服务调整",
    body:
      "产品功能和服务范围可能随版本更新而变化。涉及使用规则或个人数据的重要调整，会通过产品页面更新相关说明。"
  }
] as const;

export default function TermsPage() {
  return (
    <LegalPageView
      title="用户协议"
      updatedAt="2026年8月13日"
      lead="这份协议说明账户使用、内容处理、账号删除和服务调整规则。"
      sections={sections}
    />
  );
}
