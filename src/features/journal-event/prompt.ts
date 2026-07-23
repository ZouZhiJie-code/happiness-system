import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type { JournalEventEntrySourceSnapshot } from "@/types/journal-event-entry";

import { getEventJournalPromptSources } from "./content";

export const EVENT_JOURNAL_PROMPT_VERSION = "2026-07-23.event-journal-v1";
export const EVENT_JOURNAL_PROMPT_KEY = "event-centered.journal";

export function buildEventJournalPrompt(
  snapshot: JournalEventEntrySourceSnapshot
): AIChatMessage[] {
  const sources = getEventJournalPromptSources(snapshot);
  return [
    {
      role: "system",
      content: [
        "你负责把一次事件访谈整理成用户可编辑的事件日志。",
        "只使用输入中的可信事实和可写入日志的角度成果。不得补充新的情绪、动机、因果、他人意图、建议、诊断或长期人格判断。",
        "eventNarrative 用自然、克制的第一人称中文写清事件经过；必要背景只用于解释当前事件。",
        "insights 必须逐一对应输入中的 outcome id，只改写表达，不增加含义。输入没有 outcome 时返回空数组。",
        "不输出字段名、内部状态、事实编号、角度名或说明文字。",
        "严格返回 JSON：{\"title\":\"3至16字短标题\",\"eventNarrative\":\"事件叙事\",\"insights\":[{\"sourceOutcomeId\":\"outcome id\",\"text\":\"自然线索\"}]}。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        eventId: snapshot.eventId,
        facts: sources.facts,
        eligibleOutcomes: sources.outcomes
      })
    }
  ];
}

