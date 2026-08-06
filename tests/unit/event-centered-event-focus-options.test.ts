import { describe, expect, it } from "vitest";

import {
  inspectEventCenteredFocusOptions,
  resolveEventCenteredFocusOptions,
  splitEventCenteredSourceGroups
} from "@/features/interview/event-centered/event-focus-options";

const twoEventText =
  "回家路上看到晚霞，我特意停下来拍了一张。 另外，午饭时朋友突然问我最近好不好，我愣了一下。";

describe("event-centered event focus options", () => {
  it("按强并列分隔词保留两个完整事件句群", () => {
    expect(splitEventCenteredSourceGroups(twoEventText).map((group) => group.sourceText)).toEqual([
      "回家路上看到晚霞，我特意停下来拍了一张",
      "午饭时朋友突然问我最近好不好，我愣了一下"
    ]);

    expect(resolveEventCenteredFocusOptions({ rawText: twoEventText })).toEqual([
      {
        label: "回家路上看到晚霞，我特意停下来拍了一张",
        sourceText: "回家路上看到晚霞，我特意停下来拍了一张"
      },
      {
        label: "午饭时朋友突然问我最近好不好，我愣了一下",
        sourceText: "午饭时朋友突然问我最近好不好，我愣了一下"
      }
    ]);
  });

  it("模型把同一事件两个分句拆成两项时，改用两个事件句群", () => {
    const resolved = resolveEventCenteredFocusOptions({
      rawText: twoEventText,
      suggestedOptions: [
        { label: "看到晚霞", sourceText: "回家路上看到晚霞" },
        { label: "停下来拍照", sourceText: "我特意停下来拍了一张" }
      ]
    });

    expect(resolved?.map((option) => option.sourceText)).toEqual([
      "回家路上看到晚霞，我特意停下来拍了一张",
      "午饭时朋友突然问我最近好不好，我愣了一下"
    ]);
    expect(inspectEventCenteredFocusOptions({
      rawText: twoEventText,
      options: resolved ?? []
    })).toEqual({ passed: true, issues: [] });
  });

  it("合法短摘录只用于按钮文案，选择来源始终保存完整事件句群", () => {
    expect(resolveEventCenteredFocusOptions({
      rawText: twoEventText,
      suggestedOptions: [
        { label: "晚霞", sourceText: "看到晚霞" },
        { label: "朋友问候", sourceText: "朋友突然问我最近好不好" }
      ]
    })).toEqual([
      {
        label: "看到晚霞",
        sourceText: "回家路上看到晚霞，我特意停下来拍了一张"
      },
      {
        label: "朋友突然问我最近好不好",
        sourceText: "午饭时朋友突然问我最近好不好，我愣了一下"
      }
    ]);
  });

  it("模型把事件 B 放在前面时，归一为原话中的事件 A 到事件 B", () => {
    const resolved = resolveEventCenteredFocusOptions({
      rawText: twoEventText,
      suggestedOptions: [
        { label: "朋友问候", sourceText: "午饭时朋友突然问我最近好不好" },
        { label: "晚霞", sourceText: "回家路上看到晚霞" }
      ]
    });

    expect(resolved?.map((option) => option.sourceText)).toEqual([
      "回家路上看到晚霞，我特意停下来拍了一张",
      "午饭时朋友突然问我最近好不好，我愣了一下"
    ]);
  });

  it("识别“另外一件”并清理第二事件前的分隔词", () => {
    const rawText = "上午我完成了汇报。另外一件，晚上朋友来找我聊了很久。";
    expect(splitEventCenteredSourceGroups(rawText).map((group) => group.sourceText)).toEqual([
      "上午我完成了汇报",
      "晚上朋友来找我聊了很久"
    ]);
  });

  it("无法可靠识别两个事件句群时不生成重复或重叠按钮", () => {
    const rawText = "项目和家庭两件事都挤在一起，我一时说不清先讲哪个。";
    expect(resolveEventCenteredFocusOptions({
      rawText,
      suggestedOptions: [
        { label: "下午会议", sourceText: rawText },
        { label: "晚上误会", sourceText: rawText }
      ]
    })).toBeNull();
  });
});
