import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import { interviewSessionStorageKey } from "@/features/interview/dimensions";

const locationState = { href: "http://localhost/settings" };

vi.stubGlobal("location", locationState);

import { SettingsAccountPanel } from "@/components/auth/settings-account-panel";

describe("settings account panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    locationState.href = "http://localhost/settings";
  });

  it("logs out from the main settings page and clears scoped local state", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.localStorage.setItem(
      `${interviewSessionStorageKey}::user-1`,
      JSON.stringify({ joy: { sessionId: "session-1" } })
    );

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 })) as typeof fetch;

    render(
      <SettingsAccountPanel
        user={{
          id: "user-1",
          username: "daily_light_01"
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "退出当前账号" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
    });
    expect(window.localStorage.getItem(`${interviewSessionStorageKey}::user-1`)).toBeNull();
    expect(locationState.href).toBe("/login");
  });
});
