import { formatEntryDate, getTodayEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";

describe("entry date helpers", () => {
  it("parses YYYY-MM-DD into a Beijing-local day anchor", () => {
    expect(parseEntryDateInput("2026-04-20").toISOString()).toBe("2026-04-19T16:00:00.000Z");
  });

  it("formats persisted dates back into YYYY-MM-DD using Beijing time", () => {
    expect(formatEntryDate(new Date("2026-04-19T16:00:00.000Z"))).toBe("2026-04-20");
  });

  it("derives today from Beijing time instead of UTC", () => {
    expect(getTodayEntryDate(new Date("2026-04-19T16:30:00.000Z"))).toBe("2026-04-20");
  });

  it("rejects impossible dates even if the string shape looks valid", () => {
    expect(() => parseEntryDateInput("2026-02-30")).toThrow("INVALID_ENTRY_DATE");
  });
});
