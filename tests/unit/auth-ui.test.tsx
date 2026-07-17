import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountDangerZone } from "@/components/auth/account-danger-zone";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

describe("auth ui", () => {
  it("prevents register submit until the combined agreement is checked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RegisterForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "dailylight" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "safe-password" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "safe-password" } });

    const submitButton = screen.getByRole("button", { name: "创建账户" });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        username: "dailylight",
        password: "safe-password",
        confirmPassword: "safe-password",
        acceptedTerms: true,
        acceptedPrivacy: true
      });
    });
  });

  it("shows password mismatch error on register submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RegisterForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "dailylight" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "safe-password" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "other-password" } });
    fireEvent.blur(screen.getByLabelText("确认密码"));

    expect(screen.getByText("两次输入的密码需要保持一致。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByLabelText("确认密码"));
  });

  it("submits login form and lets the parent handle failed submit state", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("登录失败，请重试"));

    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "dailylight" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "safe-password" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        username: "dailylight",
        password: "safe-password"
      });
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses a post form action fallback so credentials do not fall back to a GET querystring", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSubmit={onSubmit} />);

    const form = screen.getByRole("button", { name: "登录并继续" }).closest("form");

    expect(form).not.toBeNull();
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/auth/login");
  });

  it("includes the next path in the fallback form payload", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSubmit={onSubmit} nextPath="/calendar?view=day" />);

    const nextInput = screen.getByDisplayValue("/calendar?view=day");

    expect(nextInput).toHaveAttribute("type", "hidden");
    expect(nextInput).toHaveAttribute("name", "next");
  });

  it("renders one agreement control with two legal links", async () => {
    render(<RegisterForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "《用户协议》" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "《隐私政策》" })).toHaveAttribute("target", "_blank");
  });

  it("requires password confirmation before delete-account action", async () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    const onLogout = vi.fn().mockResolvedValue(undefined);

    render(<AccountDangerZone username="dailylight" onDeleteAccount={onDeleteAccount} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "删除账号" }));

    expect(screen.getByRole("dialog", { name: "删除账号确认" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认删除并清空数据" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("输入当前密码以确认删除"), { target: { value: "safe-password" } });
    fireEvent.click(screen.getByRole("button", { name: "确认删除并清空数据" }));

    await waitFor(() => {
      expect(onDeleteAccount).toHaveBeenCalledWith({ password: "safe-password" });
    });
  });

  it("calls logout action when the logout button is pressed", async () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    const onLogout = vi.fn().mockResolvedValue(undefined);

    render(<AccountDangerZone username="dailylight" onDeleteAccount={onDeleteAccount} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1);
    });
  });
});
