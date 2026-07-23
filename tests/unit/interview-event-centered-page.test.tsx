import React from "react";
import { render, screen } from "@testing-library/react";

const { requireAuthenticatedPage } = vi.hoisted(() => ({
  requireAuthenticatedPage: vi.fn()
}));
const { getCalendarReadRoute } = vi.hoisted(() => ({
  getCalendarReadRoute: vi.fn()
}));

vi.mock("@/server/services/auth/auth-page-guard", () => ({
  requireAuthenticatedPage
}));
vi.mock("@/server/services/auth/admin-access", () => ({
  isAdminUsername: () => false
}));
vi.mock("@/server/services/calendar/calendar-read-route.service", () => ({
  getCalendarReadRoute
}));
vi.mock("@/components/interview/event-centered/event-centered-interview-workspace", () => ({
  EventCenteredInterviewWorkspace: (props: {
    entryDate: string;
    initialSessionId?: string | null;
    initialJournalPanelOpen?: boolean;
    initialEventEntryId?: string | null;
  }) => (
    <div data-testid="event-centered-workspace">
      {JSON.stringify(props)}
    </div>
  )
}));
vi.mock("@/components/interview/interview-shell", () => ({
  InterviewShell: () => <div data-testid="legacy-interview-shell" />
}));
vi.mock("@/components/interview/interview-dimension-picker", () => ({
  InterviewDimensionPicker: () => <div data-testid="legacy-dimension-picker" />
}));

import InterviewPage from "@/app/interview/page";

describe("event-centered interview page route", () => {
  beforeEach(() => {
    requireAuthenticatedPage.mockResolvedValue({ id: "user-1", username: "pm" });
    getCalendarReadRoute.mockReset();
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "legacy";
  });

  it("routes the event-centered deep link around the legacy InterviewShell", async () => {
    const page = await InterviewPage({
      searchParams: Promise.resolve({
        mode: "event-centered",
        sessionId: "event-root-1",
        entryDate: "2026-07-22",
        panel: "journal",
        eventEntryId: "entry-1"
      })
    });

    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent("event-root-1");
    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent("2026-07-22");
    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent("entry-1");
    expect(screen.queryByTestId("legacy-interview-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("legacy-dimension-picker")).not.toBeInTheDocument();
  });

  it("opens the event workspace for an unclaimed day after the event release is enabled", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "event_centered";
    getCalendarReadRoute.mockResolvedValue("empty");

    const page = await InterviewPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":true');
    expect(getCalendarReadRoute).toHaveBeenCalledWith("user-1", expect.any(String));
    expect(screen.queryByTestId("legacy-dimension-picker")).not.toBeInTheDocument();
  });

  it("opens an event deep link as read-only while the event release is closed", async () => {
    const page = await InterviewPage({
      searchParams: Promise.resolve({
        mode: "event-centered",
        sessionId: "event-root-1",
        entryDate: "2026-07-22"
      })
    });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":false');
  });
});
