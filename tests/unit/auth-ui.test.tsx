import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountDangerZone } from "@/components/auth/account-danger-zone";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

describe("auth ui", () => {
  it("prevents register submit until both agreements are checked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RegisterForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "dailylight" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "safe-password" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "safe-password" } });

    const submitButton = screen.getByRole("button", { name: "创建账户" });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("我已阅读并同意《用户协议》"));
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("我已阅读并同意《隐私政策》"));
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
    fireEvent.click(screen.getByLabelText("我已阅读并同意《用户协议》"));
    fireEvent.click(screen.getByLabelText("我已阅读并同意《隐私政策》"));

    fireEvent.click(screen.getByRole("button", { name: "创建账户" }));

    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByLabelText("确认密码"));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it("renders register agreement checkboxes in one group instead of split stacked notices", async () => {
    render(<RegisterForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByLabelText("我已阅读并同意《用户协议》")).toBeInTheDocument();
    expect(screen.getByLabelText("我已阅读并同意《隐私政策》")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("注册即表示你已阅读并同意"))).toBeInTheDocument();
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
