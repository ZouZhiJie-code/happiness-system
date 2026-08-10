import React from "react";
import { render, screen } from "@testing-library/react";

const { requireAuthenticatedPage } = vi.hoisted(() => ({
  requireAuthenticatedPage: vi.fn()
}));
const { getCalendarReadRoute } = vi.hoisted(() => ({
  getCalendarReadRoute: vi.fn()
}));
const { getEventCalendarDay } = vi.hoisted(() => ({
  getEventCalendarDay: vi.fn()
}));
const { recordEventCenteredAnalyticsEvent } = vi.hoisted(() => ({
  recordEventCenteredAnalyticsEvent: vi.fn()
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
vi.mock("@/server/services/event-calendar/event-calendar.service", () => ({
  getEventCalendarDay
}));
vi.mock("@/server/services/interview/event-centered-analytics.service", () => ({
  recordEventCenteredAnalyticsEvent
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
  InterviewDimensionPicker: (props: { entryDate: string; showEventCenteredEntry?: boolean }) => (
    <div data-testid="legacy-dimension-picker">{JSON.stringify(props)}</div>
  )
}));

import InterviewPage from "@/app/interview/page";

describe("event-centered interview page route", () => {
  beforeEach(() => {
    requireAuthenticatedPage.mockResolvedValue({ id: "user-1", username: "pm" });
    getCalendarReadRoute.mockReset();
    getCalendarReadRoute.mockResolvedValue("empty");
    getEventCalendarDay.mockReset();
    recordEventCenteredAnalyticsEvent.mockReset();
    recordEventCenteredAnalyticsEvent.mockResolvedValue(undefined);
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

  it("keeps five dimensions as the default and exposes the optional event entry", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";

    const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2026-07-22" }) });
    render(page);

    expect(screen.getByTestId("legacy-dimension-picker")).toHaveTextContent('"showEventCenteredEntry":true');
    expect(getCalendarReadRoute).toHaveBeenCalledWith("user-1", "2026-07-22");
    expect(recordEventCenteredAnalyticsEvent).toHaveBeenCalledWith({
      eventName: "event_centered_entry_exposed",
      userId: "user-1",
      entryDate: "2026-07-22",
      source: "optional_entry",
      dedupeKey: "event_centered_entry_exposed:user-1:2026-07-22"
    });
  });

  it("allows the explicit event workspace in optional mode and records the open", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";

    const page = await InterviewPage({
      searchParams: Promise.resolve({ mode: "event-centered", entryDate: "2026-07-22" })
    });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":true');
    expect(recordEventCenteredAnalyticsEvent).toHaveBeenCalledWith({
      eventName: "event_centered_entry_opened",
      userId: "user-1",
      entryDate: "2026-07-22",
      rootSessionId: null,
      source: "optional_entry",
      dedupeKey: "event_centered_entry_opened:user-1:2026-07-22"
    });
  });

  it("keeps the optional event entry closed for a future date", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";

    const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2999-01-01" }) });
    render(page);

    expect(screen.getByTestId("legacy-dimension-picker")).toHaveTextContent('"showEventCenteredEntry":false');
    expect(recordEventCenteredAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("resumes a recoverable event day while fresh optional days still use five dimensions", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";
    getCalendarReadRoute.mockResolvedValue("event_centered");
    getEventCalendarDay.mockResolvedValue({
      date: "2026-07-22",
      events: [{
        eventId: "event-active-1",
        rootSessionId: "root-active-1",
        state: "active",
        latestUpdatedAt: "2026-07-22T10:00:00.000Z",
        daySequence: 1
      }]
    });

    const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2026-07-22" }) });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent("root-active-1");
    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":true');
    expect(recordEventCenteredAnalyticsEvent).toHaveBeenCalledWith({
      eventName: "event_centered_entry_opened",
      userId: "user-1",
      rootSessionId: "root-active-1",
      journalEventId: "event-active-1",
      entryDate: "2026-07-22",
      source: "resume",
      dedupeKey: "event_centered_entry_opened:user-1:2026-07-22"
    });
  });

  it("resumes the most recently updated event within the highest-priority recoverable state", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";
    getCalendarReadRoute.mockResolvedValue("event_centered");
    getEventCalendarDay.mockResolvedValue({
      date: "2026-07-22",
      events: [
        {
          eventId: "event-active-old",
          rootSessionId: "root-active-old",
          state: "active",
          latestUpdatedAt: "2026-07-22T09:00:00.000Z",
          daySequence: 1
        },
        {
          eventId: "event-draft-newer",
          rootSessionId: "root-draft-newer",
          state: "draft",
          latestUpdatedAt: "2026-07-22T12:00:00.000Z",
          daySequence: 3
        },
        {
          eventId: "event-active-latest",
          rootSessionId: "root-active-latest",
          state: "active",
          latestUpdatedAt: "2026-07-22T11:00:00.000Z",
          daySequence: 2
        }
      ]
    });

    const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2026-07-22" }) });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent("root-active-latest");
  });

  it("stays in the event workspace when the owned-day event list cannot be loaded", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";
    getCalendarReadRoute.mockResolvedValue("event_centered");
    getEventCalendarDay.mockRejectedValue(new Error("EVENT_CALENDAR_QUERY_FAILED"));

    const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2026-07-22" }) });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":true');
    expect(screen.queryByTestId("legacy-dimension-picker")).not.toBeInTheDocument();
  });

  it("keeps an event-owned day in the event workspace when no recoverable event remains", async () => {
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";
    getCalendarReadRoute.mockResolvedValue("event_centered");
    getEventCalendarDay.mockResolvedValue({ date: "2026-07-22", events: [] });

    const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2026-07-22" }) });
    render(page);

    expect(screen.getByTestId("event-centered-workspace")).toHaveTextContent('"writeEnabled":true');
    expect(screen.queryByTestId("legacy-dimension-picker")).not.toBeInTheDocument();
  });

  it.each(["legacy", "dual"])(
    "keeps a %s-owned day on the five-dimension route without offering a conflicting event write",
    async (readRoute) => {
      process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";
      getCalendarReadRoute.mockResolvedValue(readRoute);

      const page = await InterviewPage({ searchParams: Promise.resolve({ entryDate: "2026-07-22" }) });
      render(page);

      expect(screen.getByTestId("legacy-dimension-picker")).toHaveTextContent('"showEventCenteredEntry":false');
      expect(getEventCalendarDay).not.toHaveBeenCalled();
      expect(recordEventCenteredAnalyticsEvent).not.toHaveBeenCalled();
    }
  );
});
