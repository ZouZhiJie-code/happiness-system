import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

describe("authentication forms", () => {
  it("shows login rules before interaction and preserves next in the register link", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} nextPath="/analysis?month=2026-05" />);

    expect(screen.getByText("3–24 位，支持中文、字母、数字和下划线。")).toBeInTheDocument();
    expect(screen.getByText("密码长度为 8–72 位。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去注册" })).toHaveAttribute(
      "href",
      "/register?next=%2Fanalysis%3Fmonth%3D2026-05"
    );
    expect(screen.getByRole("button", { name: "登录并继续" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "ab" } });
    fireEvent.blur(screen.getByLabelText("用户名"));
    expect(screen.getByText("请输入 3–24 位中文、字母、数字或下划线。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "幸福用户_1" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ username: "幸福用户_1", password: "12345678" }));
  });

  it("validates confirmation in real time and uses one agreement control", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterForm onSubmit={onSubmit} nextPath="/calendar" />);

    expect(screen.getByText("8–72 位。当前账户使用用户名与密码登录，请妥善保存。")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "《用户协议》" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "《隐私政策》" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login?next=%2Fcalendar");

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "daily_light" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "87654321" } });
    fireEvent.blur(screen.getByLabelText("确认密码"));
    expect(screen.getByText("两次输入的密码需要保持一致。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "创建账户" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        username: "daily_light",
        password: "12345678",
        confirmPassword: "12345678",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    );
  });
});
