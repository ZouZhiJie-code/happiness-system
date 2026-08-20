import React from "react";
import { render, screen } from "@testing-library/react";

const { requireAuthenticatedPage, recordEventCenteredAnalyticsEvent, redirect } = vi.hoisted(() => ({
  requireAuthenticatedPage: vi.fn(),
  recordEventCenteredAnalyticsEvent: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  })
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/server/services/auth/auth-page-guard", () => ({ requireAuthenticatedPage }));
vi.mock("@/server/services/interview/event-centered-analytics.service", () => ({
  recordEventCenteredAnalyticsEvent
}));
vi.mock("@/components/interview/event-centered/event-centered-interview-workspace", () => ({
  EventCenteredInterviewWorkspace: (props: {
    entryDate: string;
    initialSessionId?: string | null;
    initialRecordMode?: "capture" | "chat" | null;
    writeEnabled?: boolean;
  }) => <div data-testid="event-centered-workspace">{JSON.stringify(props)}</div>
}));

import InterviewPage from "@/app/interview/page";

describe("event-centered interview page route", () => {
  beforeEach(() => {
    requireAuthenticatedPage.mockResolvedValue({ id: "user-1", username: "pm" });
    recordEventCenteredAnalyticsEvent.mockReset();
    recordEventCenteredAnalyticsEvent.mockResolvedValue(undefined);
    redirect.mockClear();
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "event_centered";
  });

  it("uses the event-centered workspace as the standard interview entry", async () => {
    const page = await InterviewPage({
      searchParams: Promise.resolve({ entryDate: "2026-07-22" })
    });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"entryDate":"2026-07-22"');
    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":true');
    expect(recordEventCenteredAnalyticsEvent).toHaveBeenCalledWith({
      eventName: "event_centered_entry_opened",
      userId: "user-1",
      rootSessionId: null,
      entryDate: "2026-07-22",
      source: "default_entry",
      dedupeKey: "event_centered_entry_opened:user-1:2026-07-22"
    });
  });

  it("opens the requested event session and preserves its date", async () => {
    const page = await InterviewPage({
      searchParams: Promise.resolve({
        mode: "event-centered",
        sessionId: "event-root-1",
        entryDate: "2026-07-22"
      })
    });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"initialSessionId":"event-root-1"');
    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"entryDate":"2026-07-22"');
    expect(recordEventCenteredAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({
      rootSessionId: "event-root-1",
      source: "deep_link"
    }));
  });

  it("starts a deep-linked record mode once inside the shared workspace", async () => {
    const page = await InterviewPage({
      searchParams: Promise.resolve({
        mode: "event-centered",
        recordMode: "capture",
        entryDate: "2026-07-22"
      })
    });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"initialRecordMode":"capture"');
    expect(requireAuthenticatedPage).toHaveBeenCalledWith(
      "/interview?entryDate=2026-07-22&recordMode=capture&mode=event-centered"
    );
  });

  it("keeps a future date read-only", async () => {
    const page = await InterviewPage({
      searchParams: Promise.resolve({ entryDate: "2999-01-01" })
    });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":false');
  });

  it.each([
    { params: { dimension: "joy", entryDate: "2026-07-22" }, label: "five-dimensional link" },
    { params: { mode: "daily-journal", entryDate: "2026-07-22" }, label: "legacy daily journal link" },
    { params: { sessionId: "legacy-session", entryDate: "2026-07-22" }, label: "legacy session link" }
  ])("redirects a $label to the selected day history", async ({ params }) => {
    await expect(InterviewPage({ searchParams: Promise.resolve(params) })).rejects.toThrow(
      "REDIRECT:/calendar?view=day&date=2026-07-22"
    );
  });
});
