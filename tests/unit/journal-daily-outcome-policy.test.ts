import { describe, expect, it } from "vitest";

import {
  assembleJournalDailyEntry,
  journalDailyAssemblyPreservesSources
} from "@/features/journal-daily/assembly";
import { validateJournalDailyInsightDraft } from "@/features/journal-daily/insight-policy";
import type { JournalDailySourceEntry } from "@/types/journal-daily-entry";

const sources: JournalDailySourceEntry[] = [
  {
    eventId: "event-2",
    entryId: "entry-2",
    entryDate: "2026-07-23",
    daySequence: 2,
    title: "散步时慢下来",
    content: "傍晚散步时，我发现自己终于愿意放慢一点。",
    savedRevision: 1,
    savedAt: "2026-07-23T10:00:00.000Z"
  },
  {
    eventId: "event-1",
    entryId: "entry-1",
    entryDate: "2026-07-23",
    daySequence: 1,
    title: "把话说清楚",
    content: "下午开会时，我先听完对方，再把自己的边界说清楚。",
    savedRevision: 2,
    savedAt: "2026-07-23T09:00:00.000Z"
  }
];

describe("journal daily outcome policy", () => {
  it("按事件顺序逐字组装已保存标题和正文", () => {
    const result = assembleJournalDailyEntry(sources);

    expect(result).toEqual({
      title: "今天的记录",
      content: [
        "## 把话说清楚",
        "下午开会时，我先听完对方，再把自己的边界说清楚。",
        "",
        "## 散步时慢下来",
        "傍晚散步时，我发现自己终于愿意放慢一点。"
      ].join("\n")
    });
    expect(journalDailyAssemblyPreservesSources(result.content, sources)).toBe(true);
  });

  it("证据不足时允许返回空线索", () => {
    expect(
      validateJournalDailyInsightDraft(
        { title: "今天的记录", selfInsight: null },
        sources
      )
    ).toEqual({ accepted: true, insight: null, issues: [] });
  });

  it("只接受至少两个当前事件支持的阶段性线索", () => {
    const sharedEvidenceSources: JournalDailySourceEntry[] = [
      {
        ...sources[0]!,
        content: "傍晚散步时，我愿意慢下来，留意自己的呼吸。"
      },
      {
        ...sources[1]!,
        content: "下午开会前，我提醒自己先慢下来，听完对方再回答。"
      }
    ];
    const accepted = validateJournalDailyInsightDraft(
      {
        title: "今天的记录",
        selfInsight: {
          text: "今天暂时看见，两件事里我都在用慢下来给自己留一点空间。",
          sourceEventIds: ["event-1", "event-2"],
          sharedEvidencePhrase: "慢下来",
          evidence: [
            {
              eventId: "event-1",
              quote: "我提醒自己先慢下来，听完对方再回答"
            },
            {
              eventId: "event-2",
              quote: "我愿意慢下来，留意自己的呼吸"
            }
          ]
        }
      },
      sharedEvidenceSources
    );
    expect(accepted).toMatchObject({
      accepted: true,
      insight: {
        sourceEventIds: ["event-1", "event-2"],
        sharedEvidencePhrase: "慢下来",
        text: "今天暂时看见，“慢下来”在这几件事里都出现了。"
      }
    });

    expect(
      validateJournalDailyInsightDraft(
        {
          title: "今天的记录",
          selfInsight: {
            text: "你一直以来就是一个应该放慢节奏的人。",
            sourceEventIds: ["event-1", "event-unknown"],
            sharedEvidencePhrase: "放慢节奏",
            evidence: [
              {
                eventId: "event-1",
                quote: "下午开会时，我先听完对方"
              },
              {
                eventId: "event-unknown",
                quote: "另一件不存在的事件"
              }
            ]
          }
        },
        sources
      )
    ).toMatchObject({
      accepted: false,
      issues: expect.arrayContaining([
        "unknown_source_event",
        "missing_provisional_language",
        "unsafe_or_internal_language",
        "stable_conclusion",
        "unverifiable_source_quote"
      ])
    });
  });

  it("无关事件与生活方式、关系方向结论会被省略", () => {
    const unrelatedSources: JournalDailySourceEntry[] = [
      {
        ...sources[0]!,
        content: "傍晚我一个人去公园散步，走完以后身体轻松了一些。"
      },
      {
        ...sources[1]!,
        content: "下午开会时，我和同事把项目分工重新说清楚了。"
      }
    ];

    expect(
      validateJournalDailyInsightDraft(
        {
          title: "今天的记录",
          selfInsight: {
            text: "今天暂时看见，我更适合远离关系、独自生活。",
            sourceEventIds: ["event-1", "event-2"],
            sharedEvidencePhrase: "一个人",
            evidence: [
              {
                eventId: "event-1",
                quote: "我和同事把项目分工重新说清楚了"
              },
              {
                eventId: "event-2",
                quote: "我一个人去公园散步"
              }
            ]
          }
        },
        unrelatedSources
      )
    ).toMatchObject({
      accepted: false,
      insight: null,
      issues: expect.arrayContaining([
        "directional_conclusion",
        "unverifiable_source_quote"
      ])
    });
  });
});
