import React from "react";
import { render, screen } from "@testing-library/react";

import PrivacyPage from "@/app/legal/privacy/page";
import TermsPage from "@/app/legal/terms/page";

describe("legal pages", () => {
  test("terms page explains account, content, and deletion basics", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "用户协议" })).toBeInTheDocument();
    expect(screen.getByText("账号与使用")).toBeInTheDocument();
    expect(screen.getByText("日志内容与使用边界")).toBeInTheDocument();
    expect(screen.getByText("注销与服务调整")).toBeInTheDocument();
  });

  test("privacy page explains collected data, AI processing, and deletion", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "隐私政策" })).toBeInTheDocument();
    expect(screen.getByText("我们会收集哪些信息")).toBeInTheDocument();
    expect(screen.getByText("AI 处理与第三方服务")).toBeInTheDocument();
    expect(screen.getByText("保存、删除与联系")).toBeInTheDocument();
  });
});

