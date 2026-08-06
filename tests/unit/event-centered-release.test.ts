import {
  EventCenteredWriteBlockedError,
  assertEventCenteredWriteAllowed,
  getEventCenteredReleaseMode,
  isEventCenteredDefaultEntryEnabled,
  isEventCenteredEntryEnabled,
  isEventCenteredOptionalEntryVisible,
  isEventCenteredRecoveryMode,
  isEventCenteredWriteEnabled
} from "@/features/interview/event-centered-release";

describe("event centered release mode", () => {
  it.each([
    [undefined, "legacy"],
    ["legacy", "legacy"],
    ["optional", "optional"],
    ["event_centered", "event_centered"],
    ["event_recovery", "event_recovery"],
    ["unexpected", "legacy"]
  ] as const)("normalizes %s to %s", (configured, expected) => {
    expect(getEventCenteredReleaseMode({ INTERVIEW_EVENT_CENTERED_MODE: configured })).toBe(expected);
  });

  it("separates the default entry from optional event writes", () => {
    expect(isEventCenteredDefaultEntryEnabled("legacy")).toBe(false);
    expect(isEventCenteredDefaultEntryEnabled("optional")).toBe(false);
    expect(isEventCenteredDefaultEntryEnabled("event_centered")).toBe(true);
    expect(isEventCenteredOptionalEntryVisible("optional")).toBe(true);
    expect(isEventCenteredOptionalEntryVisible("event_centered")).toBe(false);
    expect(isEventCenteredWriteEnabled("legacy")).toBe(false);
    expect(isEventCenteredWriteEnabled("optional")).toBe(true);
    expect(isEventCenteredWriteEnabled("event_centered")).toBe(true);
    expect(isEventCenteredWriteEnabled("event_recovery")).toBe(false);

    expect(isEventCenteredEntryEnabled("legacy")).toBe(false);
    expect(isEventCenteredEntryEnabled("optional")).toBe(true);
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
    expect(() => assertEventCenteredWriteAllowed({ mode: "optional" })).not.toThrow();
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
