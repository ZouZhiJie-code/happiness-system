import { setLocalAuthUserId } from "@/features/auth/auth-local";
import {
  buildComposerDraftKey,
  clearComposerDraft,
  clearUserTurnOutbox,
  readComposerDraft,
  readUserTurnOutbox,
  writeComposerDraft,
  writeUserTurnOutbox
} from "@/features/interview/user-turn-storage";

describe("interview UserTurn session storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocalAuthUserId("user-1");
  });

  it("isolates composer drafts by user, date, dimension, and session", () => {
    const scope = {
      sessionId: "session-joy",
      entryDate: "2026-07-20",
      dimension: "joy" as const
    };

    writeComposerDraft(scope, "  仍在输入中的原文  ");

    expect(buildComposerDraftKey(scope)).toContain("user-1::2026-07-20::joy::session-joy");
    expect(readComposerDraft(scope)).toBe("  仍在输入中的原文  ");
    expect(
      readComposerDraft({
        ...scope,
        dimension: "reflection"
      })
    ).toBe("");

    clearComposerDraft(scope);
    expect(readComposerDraft(scope)).toBe("");
  });

  it("persists and clears the pending outbox without rewriting rawText", () => {
    writeUserTurnOutbox({
      clientTurnId: "client-turn-1",
      sessionId: "session-1",
      action: "reply",
      rawText: "  原样保留\n这一段  ",
      inputMode: "text",
      baseMessageSequence: 3,
      status: "submitting",
      createdAt: "2026-07-20T00:00:00.000Z"
    });

    expect(readUserTurnOutbox("session-1")).toEqual({
      clientTurnId: "client-turn-1",
      sessionId: "session-1",
      action: "reply",
      rawText: "  原样保留\n这一段  ",
      inputMode: "text",
      baseMessageSequence: 3,
      status: "submitting",
      createdAt: "2026-07-20T00:00:00.000Z"
    });

    clearUserTurnOutbox("session-1");
    expect(readUserTurnOutbox("session-1")).toBeNull();
  });

  it("rejects malformed outbox data during recovery", () => {
    const key = "hs-interview-user-turn-outbox::user-1::session-1";
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        clientTurnId: "client-turn-1",
        sessionId: "session-1",
        action: "unknown_action"
      })
    );

    expect(readUserTurnOutbox("session-1")).toBeNull();
  });
});
