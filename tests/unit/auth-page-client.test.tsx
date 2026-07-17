import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";

const { mockRouterPush, mockRouterRefresh } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockRouterRefresh: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh
  })
}));

import { LoginPageClient } from "@/components/auth/login-page-client";
import { RegisterPageClient } from "@/components/auth/register-page-client";

describe("auth page client navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("redirects login success to next path when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true, user: { id: "user-1", username: "daily_light_01" } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<LoginPageClient nextPath="/analysis?month=2026-05" />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "daily_light_01" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/analysis?month=2026-05");
    });
    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBe("user-1");
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("shows only the localized login error copy when login fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "INVALID_LOGIN_REQUEST" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "daily_light_01" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("登录信息格式不正确");
    expect(screen.queryByText("INVALID_LOGIN_REQUEST")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByLabelText("用户名"));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("shows a database-initialization hint when login storage is not ready", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "AUTH_STORAGE_NOT_READY" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "daily_light_01" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("登录暂时不可用，请先完成数据库初始化");
  });

  it("redirects register success to next path when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true, user: { id: "user-2", username: "new_user_01" } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<RegisterPageClient nextPath="/calendar" />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "new_user_01" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "创建账户" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/calendar");
    });
    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBe("user-2");
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("shows only the localized register error copy and clears it on input focus", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "USERNAME_ALREADY_EXISTS" }), {
        status: 409,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<RegisterPageClient />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "daily_light_01" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "创建账户" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("这个用户名已经被占用");

    fireEvent.focus(screen.getByLabelText("用户名"));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("shows localized register format errors without leaking raw backend codes", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "INVALID_REGISTER_REQUEST" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<RegisterPageClient />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "new_user_01" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "创建账户" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("用户名仅支持 3-24 位中文、字母、数字或下划线，密码需至少 8 位");
    expect(screen.queryByText("INVALID_REGISTER_REQUEST")).not.toBeInTheDocument();
  });

  it("shows a database-initialization hint when registration storage is not ready", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "AUTH_STORAGE_NOT_READY" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json"
        }
      })
    ) as typeof fetch;

    render(<RegisterPageClient />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "邹志杰" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "supersecret1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "创建账户" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("注册暂时不可用，请先完成数据库初始化");
  });
});
