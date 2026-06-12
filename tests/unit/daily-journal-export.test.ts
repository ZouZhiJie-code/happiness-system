import { describe, expect, it } from "vitest";

import {
  buildDailyJournalExportFilename,
  buildDailyJournalMarkdown,
  sanitizeDailyJournalExportTitle
} from "@/features/daily-journal/export";

describe("daily journal export", () => {
  it("builds markdown with title, date header, and content", () => {
    const markdown = buildDailyJournalMarkdown({
      date: "2026-06-12",
      title: "日有所记",
      content: "## 开心\n今天起得很早。"
    });

    expect(markdown).toBe(
      "# 日有所记\n\n2026-06-12 · Daily Light\n\n---\n\n## 开心\n今天起得很早。"
    );
  });

  it("trims title and content before building markdown", () => {
    const markdown = buildDailyJournalMarkdown({
      date: "2026-06-12",
      title: "  日有所记  ",
      content: "  正文  "
    });

    expect(markdown).toContain("# 日有所记\n\n2026-06-12 · Daily Light");
    expect(markdown.endsWith("正文")).toBe(true);
  });

  it("sanitizes invalid filename characters and truncates long titles", () => {
    expect(sanitizeDailyJournalExportTitle('标题/含:非法\\字符')).toBe("标题-含-非法-字符");
    expect(sanitizeDailyJournalExportTitle("a".repeat(40)).length).toBe(32);
    expect(sanitizeDailyJournalExportTitle("   ")).toBe("未命名");
  });

  it("builds export filename with date and sanitized title", () => {
    expect(
      buildDailyJournalExportFilename({
        date: "2026-06-12",
        title: "日有所记"
      })
    ).toBe("2026-06-12_完整日志_日有所记.md");
  });
});
