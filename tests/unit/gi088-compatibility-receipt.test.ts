import { beforeEach, describe, expect, it } from "vitest";

import {
  clearGi088HelpRecordReceipt,
  readGi088HelpRecordReceipt,
  writeGi088HelpRecordReceipt
} from "@/features/interview/event-centered/gi088-compatibility-receipt";

describe("GI-088 help-record receipt", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shares only the product session receipt for the exact run and task", () => {
    writeGi088HelpRecordReceipt({
      runId: "run-1",
      taskId: "A5",
      productSessionId: "capture-session-1",
      recordedAt: "2026-08-11T00:00:00.000Z"
    });

    expect(readGi088HelpRecordReceipt({ runId: "run-1", taskId: "A5" }))
      .toMatchObject({ productSessionId: "capture-session-1" });
    expect(readGi088HelpRecordReceipt({ runId: "run-1", taskId: "A6" }))
      .toBeNull();
    clearGi088HelpRecordReceipt({ runId: "run-1", taskId: "A5" });
    expect(readGi088HelpRecordReceipt({ runId: "run-1", taskId: "A5" }))
      .toBeNull();
  });
});
