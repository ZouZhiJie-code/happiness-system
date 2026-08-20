import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import { eventCenteredTurnOutboxStoragePrefix } from "@/features/interview/client-recovery-state";
import { interviewSessionStorageKey } from "@/features/interview/dimensions";

const locationState = { href: "http://localhost/settings/account", replace: vi.fn() };

vi.stubGlobal("location", locationState);

import { AccountSettingsClient } from "@/components/auth/account-settings-client";

describe("account settings client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    locationState.href = "http://localhost/settings/account";
    locationState.replace.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps logout in the account menu so settings has one account exit path", async () => {
    render(
      <AccountSettingsClient
        user={{
          id: "user-1",
          username: "daily_light_01"
        }}
      />
    );

    expect(await screen.findByText("daily_light_01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除账号" })).toBeInTheDocument();
  });

  it("clears local auth context and interview cache on account deletion", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.localStorage.setItem(`${interviewSessionStorageKey}::user-1`, JSON.stringify({ joy: { sessionId: "session-1" } }));
    const recoveryKey = `${eventCenteredTurnOutboxStoragePrefix}::user-1::root-1::branch-1`;
    const otherRecoveryKey = `${eventCenteredTurnOutboxStoragePrefix}::user-2::root-2::branch-2`;
    window.sessionStorage.setItem(recoveryKey, JSON.stringify({ rawText: "当前用户原话" }));
    window.sessionStorage.setItem(otherRecoveryKey, JSON.stringify({ rawText: "其他用户原话" }));

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })) as typeof fetch;

    render(
      <AccountSettingsClient
        user={{
          id: "user-1",
          username: "daily_light_01"
        }}
      />
    );

    await screen.findByText("daily_light_01");
    fireEvent.click(screen.getByRole("button", { name: "删除账号" }));
    fireEvent.change(screen.getByLabelText("输入当前密码以确认删除"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("button", { name: "确认删除并清空数据" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
    });
    expect(window.localStorage.getItem(`${interviewSessionStorageKey}::user-1`)).toBeNull();
    expect(window.sessionStorage.getItem(recoveryKey)).toBeNull();
    expect(window.sessionStorage.getItem(otherRecoveryKey)).toContain("其他用户原话");
    expect(locationState.replace).toHaveBeenCalledWith("/");
  });

  it("preserves recovery state when account deletion is rejected by the server", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.localStorage.setItem(`${interviewSessionStorageKey}::user-1`, "账号恢复状态");
    const recoveryKey = `${eventCenteredTurnOutboxStoragePrefix}::user-1::root-1::branch-1`;
    window.sessionStorage.setItem(recoveryKey, JSON.stringify({ rawText: "等待重试的原话" }));
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "INVALID_CREDENTIALS" }), { status: 401 })
    ) as typeof fetch;

    render(
      <AccountSettingsClient
        user={{
          id: "user-1",
          username: "daily_light_01"
        }}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "删除账号" }));
    fireEvent.change(screen.getByLabelText("输入当前密码以确认删除"), { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("button", { name: "确认删除并清空数据" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("当前密码不正确");
    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBe("user-1");
    expect(window.localStorage.getItem(`${interviewSessionStorageKey}::user-1`)).toBe("账号恢复状态");
    expect(window.sessionStorage.getItem(recoveryKey)).toContain("等待重试的原话");
    expect(locationState.replace).not.toHaveBeenCalled();
  });

  it("completes account-deletion navigation when browser storage rejects cleanup", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.sessionStorage.setItem(
      `${eventCenteredTurnOutboxStoragePrefix}::user-1::root-1::branch-1`,
      "浏览器限制下的原话"
    );
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 })
    ) as typeof fetch;

    render(
      <AccountSettingsClient
        user={{
          id: "user-1",
          username: "daily_light_01"
        }}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "删除账号" }));
    fireEvent.change(screen.getByLabelText("输入当前密码以确认删除"), { target: { value: "supersecret1" } });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    fireEvent.click(screen.getByRole("button", { name: "确认删除并清空数据" }));

    await waitFor(() => expect(locationState.replace).toHaveBeenCalledWith("/"));
  });
});
