import {
  EventCenteredWriteBlockedError,
  assertEventCenteredWriteAllowed,
  getEventCenteredReleaseMode,
  isEventCenteredEntryEnabled,
  isEventCenteredRecoveryMode
} from "@/features/interview/event-centered-release";

describe("event centered release mode", () => {
  it.each([
    [undefined, "legacy"],
    ["legacy", "legacy"],
    ["event_centered", "event_centered"],
    ["event_recovery", "event_recovery"],
    ["unexpected", "legacy"]
  ] as const)("normalizes %s to %s", (configured, expected) => {
    expect(getEventCenteredReleaseMode({ INTERVIEW_EVENT_CENTERED_MODE: configured })).toBe(expected);
  });

  it("only permits a new default event entry in the event-centered release", () => {
    expect(isEventCenteredEntryEnabled("legacy")).toBe(false);
    expect(isEventCenteredEntryEnabled("event_centered")).toBe(true);
    expect(isEventCenteredEntryEnabled("event_recovery")).toBe(false);
  });

  it("marks the recovery release explicitly", () => {
    expect(isEventCenteredRecoveryMode("legacy")).toBe(false);
    expect(isEventCenteredRecoveryMode("event_recovery")).toBe(true);
  });

  it("keeps reading releases from accepting new event writes", () => {
    expect(() => assertEventCenteredWriteAllowed({ mode: "legacy" })).toThrow(
      new EventCenteredWriteBlockedError("EVENT_CENTERED_ENTRY_DISABLED")
    );
    expect(() => assertEventCenteredWriteAllowed({ mode: "event_recovery" })).toThrow(
      new EventCenteredWriteBlockedError("EVENT_CENTERED_ENTRY_DISABLED")
    );
    expect(() => assertEventCenteredWriteAllowed({ mode: "event_centered" })).not.toThrow();
  });

  it("does not create a future-dated event", () => {
    expect(() =>
      assertEventCenteredWriteAllowed({
        mode: "event_centered",
        entryDate: "2026-07-23",
        today: "2026-07-22"
      })
    ).toThrow(new EventCenteredWriteBlockedError("EVENT_CENTERED_FUTURE_DATE"));
  });
});
