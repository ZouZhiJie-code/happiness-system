import { describe, expect, it } from "vitest";

import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";

describe("journal daily source signature", () => {
  it("sorts sources by the user's event sequence, then by entry id, without changing the input", () => {
    const sources = [
      { eventId: "event-2", entryId: "entry-b", daySequence: 2, savedRevision: 4 },
      { eventId: "event-1", entryId: "entry-c", daySequence: 1, savedRevision: 2 },
      { eventId: "event-1b", entryId: "entry-a", daySequence: 1, savedRevision: 3 }
    ];

    expect(buildJournalDailySourceSignature(sources)).toBe(
      "v1|event:event-1b|entry:entry-a|seq:1|saved:3|event:event-1|entry:entry-c|seq:1|saved:2|event:event-2|entry:entry-b|seq:2|saved:4"
    );
    expect(sources.map((source) => source.entryId)).toEqual(["entry-b", "entry-c", "entry-a"]);
  });

  it("changes when the saved source revision changes", () => {
    const source = {
      eventId: "event-1",
      entryId: "entry-1",
      daySequence: 1,
      savedRevision: 1
    };

    expect(buildJournalDailySourceSignature([source])).not.toBe(
      buildJournalDailySourceSignature([{ ...source, savedRevision: 2 }])
    );
  });
});
