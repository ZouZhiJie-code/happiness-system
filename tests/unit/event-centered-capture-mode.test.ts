import { describe, expect, it } from "vitest";

import {
  buildCaptureAcknowledgement,
  buildCaptureJournalDraft,
  EVENT_CENTERED_CAPTURE_OPENING,
  isEffectiveCaptureContent
} from "@/features/interview/event-centered/capture-mode";
import { startEventCenteredSessionRequestSchema } from "@/features/interview/schema/event-centered-interview.schema";

describe("event-centered capture mode", () => {
  it("新记录请求必须显式选择 capture 或 chat", () => {
    expect(startEventCenteredSessionRequestSchema.safeParse({
      entryDate: "2026-08-11"
    }).success).toBe(false);
    expect(startEventCenteredSessionRequestSchema.parse({
      entryDate: "2026-08-11",
      recordMode: "capture"
    })).toEqual({ entryDate: "2026-08-11", recordMode: "capture" });
  });

  it("开场和每种承接都保持零问号", () => {
    const statements = [
      EVENT_CENTERED_CAPTURE_OPENING,
      buildCaptureAcknowledgement("今天终于把积压的事情做完了。"),
      buildCaptureAcknowledgement("我是不是反应太大了？")
    ];

    expect(statements).toEqual([
      "这里是【帮我记】。写下此刻想留下的内容就好。",
      "好，这一段已经记下了。",
      "这份疑问也记下了。"
    ]);
    expect(statements.join("\n")).not.toMatch(/[？?]/u);
  });

  it("把提问式输入当作记录内容，连续多段按原话顺序进入日志", () => {
    const draft = buildCaptureJournalDraft([
      "今天和同事把方案定下来了。",
      "我是不是终于敢把边界说清楚了？",
      "回家路上轻松了很多。"
    ]);

    expect(draft).toMatchObject({
      title: "和同事把方案定下来了",
      content: [
        "今天和同事把方案定下来了。",
        "我是不是终于敢把边界说清楚了？",
        "回家路上轻松了很多。"
      ].join("\n\n")
    });
  });

  it("纯操作词会可靠保存但不成为日志正文来源", () => {
    expect(isEffectiveCaptureContent("先记一下")).toBe(false);
    expect(isEffectiveCaptureContent("嗯")).toBe(false);
    expect(isEffectiveCaptureContent("今天其实有点委屈")).toBe(true);
    expect(buildCaptureJournalDraft(["先记一下", "嗯", "今天其实有点委屈"])?.content)
      .toBe("今天其实有点委屈");
  });
});
