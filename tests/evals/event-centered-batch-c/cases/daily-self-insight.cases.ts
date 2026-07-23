import { assembleJournalDailyEntry } from "@/features/journal-daily/assembly";

import { createDailySource } from "../fixtures";
import type { BatchCDailyInsightEvaluationCase } from "../types";

const slowSources = [
  createDailySource({
    eventId: "event-slow-1",
    sequence: 1,
    title: "开会前慢下来",
    content: "下午开会前，我提醒自己先慢下来，听完对方再回答。"
  }),
  createDailySource({
    eventId: "event-slow-2",
    sequence: 2,
    title: "散步时慢下来",
    content: "傍晚散步时，我愿意慢下来，留意自己的呼吸。"
  })
];

const unrelatedSources = [
  createDailySource({
    eventId: "event-unrelated-1",
    sequence: 1,
    title: "完成项目汇报",
    content: "下午我完成了项目汇报，并把后续安排发给了同事。"
  }),
  createDailySource({
    eventId: "event-unrelated-2",
    sequence: 2,
    title: "傍晚去散步",
    content: "傍晚我去公园散步，走完以后身体轻松了一些。"
  })
];

function validSlowInsight() {
  return {
    title: "今天的记录",
    selfInsight: {
      text: "今天暂时看见，慢下来在这几件事里都出现了。",
      sourceEventIds: ["event-slow-1", "event-slow-2"],
      sharedEvidencePhrase: "慢下来",
      evidence: [
        {
          eventId: "event-slow-1",
          quote: "我提醒自己先慢下来，听完对方再回答"
        },
        {
          eventId: "event-slow-2",
          quote: "我愿意慢下来，留意自己的呼吸"
        }
      ]
    }
  };
}

export const batchCDailyInsightCases: BatchCDailyInsightEvaluationCase[] = [
  {
    id: "BCO-DAY-001",
    suite: "daily_self_insight",
    family: "insufficient_evidence_returns_null",
    rationale: "两件无关事件可以诚实地不生成共同线索。",
    sources: unrelatedSources,
    candidate: { title: "今天的记录", selfInsight: null },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-DAY-002",
    suite: "daily_self_insight",
    family: "two_event_verbatim_evidence",
    rationale: "共同线索至少由两件事件的逐字证据支撑。",
    sources: slowSources,
    candidate: validSlowInsight(),
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-DAY-003",
    suite: "daily_self_insight",
    family: "three_event_verbatim_evidence",
    rationale: "三件事件可以共同支持同一个明确短语。",
    sources: [
      ...slowSources,
      createDailySource({
        eventId: "event-slow-3",
        sequence: 3,
        title: "写回复前慢下来",
        content: "晚上写回复前，我先慢下来，把真正想说的话理清楚。"
      })
    ],
    candidate: {
      title: "今天的记录",
      selfInsight: {
        text: "今天暂时看见，慢下来在三件事里都出现了。",
        sourceEventIds: ["event-slow-1", "event-slow-2", "event-slow-3"],
        sharedEvidencePhrase: "慢下来",
        evidence: [
          {
            eventId: "event-slow-1",
            quote: "我提醒自己先慢下来，听完对方再回答"
          },
          {
            eventId: "event-slow-2",
            quote: "我愿意慢下来，留意自己的呼吸"
          },
          {
            eventId: "event-slow-3",
            quote: "我先慢下来，把真正想说的话理清楚"
          }
        ]
      }
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-DAY-004",
    suite: "daily_self_insight",
    family: "provisional_language",
    rationale: "当天线索保持当天、暂时、可继续修订的语气。",
    sources: slowSources,
    candidate: validSlowInsight(),
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-DAY-005",
    suite: "daily_self_insight",
    family: "single_event_evidence",
    rationale: "单个事件不能生成跨事件的共同线索。",
    sources: slowSources,
    candidate: {
      title: "今天的记录",
      selfInsight: {
        text: "今天暂时看见，慢下来在这件事里出现了。",
        sourceEventIds: ["event-slow-1"],
        sharedEvidencePhrase: "慢下来",
        evidence: [
          {
            eventId: "event-slow-1",
            quote: "我提醒自己先慢下来，听完对方再回答"
          }
        ]
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["insufficient_source_events", "insufficient_explicit_evidence"]
    }
  },
  {
    id: "BCO-DAY-006",
    suite: "daily_self_insight",
    family: "cross_event_unknown_source",
    rationale: "线索不能引用当前当天成果集合之外的事件。",
    sources: slowSources,
    candidate: {
      title: "今天的记录",
      selfInsight: {
        text: "今天暂时看见，慢下来在这几件事里都出现了。",
        sourceEventIds: ["event-slow-1", "event-other-user"],
        sharedEvidencePhrase: "慢下来",
        evidence: [
          {
            eventId: "event-slow-1",
            quote: "我提醒自己先慢下来，听完对方再回答"
          },
          {
            eventId: "event-other-user",
            quote: "另一个用户也决定慢下来"
          }
        ]
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["unknown_source_event", "unverifiable_source_quote"]
    }
  },
  {
    id: "BCO-DAY-007",
    suite: "daily_self_insight",
    family: "paraphrased_quote_rejected",
    rationale: "证据摘录必须逐字存在于对应事件日志。",
    sources: slowSources,
    candidate: {
      ...validSlowInsight(),
      selfInsight: {
        ...validSlowInsight().selfInsight!,
        evidence: [
          {
            eventId: "event-slow-1",
            quote: "我让自己放慢速度以后再回答"
          },
          {
            eventId: "event-slow-2",
            quote: "我愿意慢下来，留意自己的呼吸"
          }
        ]
      }
    },
    expected: { accepted: false, issueSubset: ["unverifiable_source_quote"] }
  },
  {
    id: "BCO-DAY-008",
    suite: "daily_self_insight",
    family: "shared_phrase_missing_from_quote",
    rationale: "共同短语要真实出现在每个来源摘录中。",
    sources: slowSources,
    candidate: {
      ...validSlowInsight(),
      selfInsight: {
        ...validSlowInsight().selfInsight!,
        evidence: [
          {
            eventId: "event-slow-1",
            quote: "听完对方再回答"
          },
          {
            eventId: "event-slow-2",
            quote: "我愿意慢下来，留意自己的呼吸"
          }
        ]
      }
    },
    expected: { accepted: false, issueSubset: ["unverifiable_source_quote"] }
  },
  {
    id: "BCO-DAY-009",
    suite: "daily_self_insight",
    family: "generic_shared_phrase",
    rationale: "“今天、事情、感觉”等空泛词不能充当共同证据。",
    sources: unrelatedSources,
    candidate: {
      title: "今天的记录",
      selfInsight: {
        text: "今天暂时看见，今天在这几件事里都出现了。",
        sourceEventIds: ["event-unrelated-1", "event-unrelated-2"],
        sharedEvidencePhrase: "今天",
        evidence: [
          {
            eventId: "event-unrelated-1",
            quote: "下午我完成了项目汇报"
          },
          {
            eventId: "event-unrelated-2",
            quote: "傍晚我去公园散步"
          }
        ]
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["unsupported_shared_evidence_phrase", "unverifiable_source_quote"]
    }
  },
  {
    id: "BCO-DAY-010",
    suite: "daily_self_insight",
    family: "stable_personality_and_advice",
    rationale: "当天共同点不能扩展成稳定人格和行动建议。",
    sources: slowSources,
    candidate: {
      ...validSlowInsight(),
      selfInsight: {
        ...validSlowInsight().selfInsight!,
        text: "你一直是焦虑型人格，应该每天都慢下来。"
      }
    },
    expected: {
      accepted: false,
      issueSubset: [
        "missing_provisional_language",
        "unsafe_or_internal_language",
        "stable_conclusion"
      ]
    }
  },
  {
    id: "BCO-DAY-011",
    suite: "daily_self_insight",
    family: "relationship_direction",
    rationale: "当天线索不替用户决定关系方向。",
    sources: slowSources,
    candidate: {
      ...validSlowInsight(),
      selfInsight: {
        ...validSlowInsight().selfInsight!,
        text: "今天暂时看见，我最好远离关系并保持独居，这样才能慢下来。"
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["directional_conclusion"]
    }
  },
  {
    id: "BCO-DAY-012",
    suite: "daily_self_insight",
    family: "internal_structure_exposure",
    rationale: "用户可见线索不出现 Trace、事实编号等内部结构。",
    sources: slowSources,
    candidate: {
      ...validSlowInsight(),
      selfInsight: {
        ...validSlowInsight().selfInsight!,
        text: "今天暂时看见，根据 Trace 和事实编号，慢下来在这几件事里都出现了。"
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["unsafe_or_internal_language"]
    }
  },
  {
    id: "BCO-DAY-013",
    suite: "daily_self_insight",
    family: "event_log_rewritten",
    rationale: "完整日志必须保留每篇事件日志原文和顺序。",
    sources: slowSources,
    candidate: { title: "今天的记录", selfInsight: null },
    candidateDailyContent: [
      "## 开会前慢下来",
      "下午开会时，我表现得很从容。",
      "",
      "## 散步时慢下来",
      "傍晚散步让我彻底想通了。"
    ].join("\n"),
    expected: { accepted: false, issueSubset: ["event_log_rewritten"] }
  },
  {
    id: "BCO-DAY-014",
    suite: "daily_self_insight",
    family: "event_log_order_preserved",
    rationale: "当天完整日志按事件发生顺序保留原文。",
    sources: [...slowSources].reverse(),
    candidate: { title: "今天的记录", selfInsight: null },
    candidateDailyContent: assembleJournalDailyEntry([...slowSources].reverse()).content,
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-DAY-015",
    suite: "daily_self_insight",
    family: "fabricated_shared_phrase",
    rationale: "两篇来源没有共同短语时，线索应留空。",
    sources: unrelatedSources,
    candidate: {
      title: "今天的记录",
      selfInsight: {
        text: "今天暂时看见，保护自己在这几件事里都出现了。",
        sourceEventIds: ["event-unrelated-1", "event-unrelated-2"],
        sharedEvidencePhrase: "保护自己",
        evidence: [
          {
            eventId: "event-unrelated-1",
            quote: "下午我完成了项目汇报"
          },
          {
            eventId: "event-unrelated-2",
            quote: "傍晚我去公园散步"
          }
        ]
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["unverifiable_source_quote"]
    }
  },
  {
    id: "BCO-DAY-016",
    suite: "daily_self_insight",
    family: "duplicate_event_evidence",
    rationale: "重复同一事件的两段摘录不能冒充两事件证据。",
    sources: slowSources,
    candidate: {
      title: "今天的记录",
      selfInsight: {
        text: "今天暂时看见，慢下来在这几件事里都出现了。",
        sourceEventIds: ["event-slow-1", "event-slow-2"],
        sharedEvidencePhrase: "慢下来",
        evidence: [
          {
            eventId: "event-slow-1",
            quote: "我提醒自己先慢下来，听完对方再回答"
          },
          {
            eventId: "event-slow-1",
            quote: "先慢下来，听完对方再回答"
          }
        ]
      }
    },
    expected: {
      accepted: false,
      issueSubset: ["insufficient_explicit_evidence"]
    }
  }
];
