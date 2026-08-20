import { describe, expect, it } from "vitest";

import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";

describe("journal daily source signature", () => {
  it("sorts sources by the user's event sequence, then by entry id, without changing the input", () => {
    const sources = [
      { entryId: "entry-b", daySequence: 2, contentRevision: 4 },
      { entryId: "entry-c", daySequence: 1, contentRevision: 2 },
      { entryId: "entry-a", daySequence: 1, contentRevision: 3 }
    ];

    expect(buildJournalDailySourceSignature(sources)).toBe(
      "v2|record:entry-a|revision:3|seq:1|record:entry-c|revision:2|seq:1|record:entry-b|revision:4|seq:2"
    );
    expect(sources.map((source) => source.entryId)).toEqual(["entry-b", "entry-c", "entry-a"]);
  });

  it("changes when the current record revision changes", () => {
    const source = {
      entryId: "entry-1",
      daySequence: 1,
      contentRevision: 1
    };

    expect(buildJournalDailySourceSignature([source])).not.toBe(
      buildJournalDailySourceSignature([{ ...source, contentRevision: 2 }])
    );
  });
});
