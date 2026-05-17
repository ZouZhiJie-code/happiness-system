import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import { interviewSessionStorageKey } from "@/features/interview/dimensions";

const locationState = { href: "http://localhost/settings/account" };

vi.stubGlobal("location", locationState);

import { AccountSettingsClient } from "@/components/auth/account-settings-client";

describe("account settings client", () => {
  beforeEach(() => {
    window.localStorage.clear();
    locationState.href = "http://localhost/settings/account";
  });

  it("clears local auth context and interview cache on logout", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.localStorage.setItem(`${interviewSessionStorageKey}::user-1`, JSON.stringify({ joy: { sessionId: "session-1" } }));

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 })) as typeof fetch;

    render(
      <AccountSettingsClient
        user={{
          id: "user-1",
          username: "daily_light_01"
        }}
      />
    );

    await screen.findByText("daily_light_01");
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
    });
    expect(window.localStorage.getItem(`${interviewSessionStorageKey}::user-1`)).toBeNull();
    expect(locationState.href).toBe("/login");
  });

  it("clears local auth context and interview cache on account deletion", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.localStorage.setItem(`${interviewSessionStorageKey}::user-1`, JSON.stringify({ joy: { sessionId: "session-1" } }));

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
    expect(locationState.href).toBe("/register");
  });
});
