import React from "react";
import { render, screen } from "@testing-library/react";

import PrivacyPage from "@/app/legal/privacy/page";
import TermsPage from "@/app/legal/terms/page";

describe("legal pages", () => {
  test("terms page explains account, content, and deletion basics", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "用户协议" })).toBeInTheDocument();
    expect(screen.getByText("账户与使用")).toBeInTheDocument();
    expect(screen.getByText("你提交的内容")).toBeInTheDocument();
    expect(screen.getByText("删除账号")).toBeInTheDocument();
    expect(screen.getByText(/你可以随时在“设置”中删除账号/)).toBeInTheDocument();
    expect(screen.queryByText(/后续开放/)).not.toBeInTheDocument();
  });

  test("privacy page explains collected data, AI processing, and deletion", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "隐私政策" })).toBeInTheDocument();
    expect(screen.getByText("保存哪些内容")).toBeInTheDocument();
    expect(screen.getByText("怎样使用这些内容")).toBeInTheDocument();
    expect(screen.getByText("删除账号和数据")).toBeInTheDocument();
    expect(screen.getByText(/你可以在“设置”中删除账号/)).toBeInTheDocument();
  });
});
