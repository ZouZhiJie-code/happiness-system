import { createEventSnapshot } from "../fixtures";
import type { BatchCEventJournalEvaluationCase } from "../types";

const meetingSnapshot = createEventSnapshot({
  eventId: "event-meeting",
  facts: [
    { id: "fact-meeting-1", statement: "下午开会时，我先听完同事，再把自己的边界说清楚。" },
    { id: "fact-meeting-2", statement: "说清楚之后，我感觉轻松了一些。" }
  ]
});

const correctedSnapshot = createEventSnapshot({
  eventId: "event-corrected",
  facts: [
    {
      id: "fact-old",
      statement: "我因为方案被否定而生气。",
      effective: false
    },
    {
      id: "fact-new",
      statement: "我并没有生气，只是担心时间不够。",
      stance: "affirmed"
    }
  ]
});

const outcomeSnapshot = createEventSnapshot({
  eventId: "event-outcome",
  facts: [
    { id: "fact-outcome-1", statement: "汇报前我反复检查了三遍材料。" }
  ],
  outcomes: [
    {
      id: "outcome-thought",
      statement: "我把是否还有意外，当作准备是否充分的线索。"
    }
  ]
});

export const batchCEventJournalCases: BatchCEventJournalEvaluationCase[] = [
  {
    id: "BCO-EVT-001",
    suite: "event_journal",
    family: "grounded_single_event",
    rationale: "清楚事件应形成只包含可信事实的自然叙事。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "下午开会时，我先听完同事，再把自己的边界说清楚。说清楚之后，我感觉轻松了一些。",
      insights: []
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-EVT-002",
    suite: "event_journal",
    family: "grounded_natural_paraphrase",
    rationale: "自然压缩可以保留事件语义，避免机械复制。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "开会时说清边界",
      eventNarrative: "下午开会，我先听完同事，再说清自己的边界，之后轻松了一些。",
      insights: []
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-EVT-003",
    suite: "event_journal",
    family: "eligible_outcome_preserved",
    rationale: "已经完成的角度线索可以自然改写，并保持来源关联。",
    snapshot: outcomeSnapshot,
    candidate: {
      title: "汇报前的反复检查",
      eventNarrative: "汇报前，我反复检查了三遍材料。",
      insights: [
        {
          sourceOutcomeId: "outcome-thought",
          text: "我会用是否还有意外，判断准备是否充分。"
        }
      ]
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-EVT-004",
    suite: "event_journal",
    family: "correction_respected",
    rationale: "日志只读取纠正后的当前事实。",
    snapshot: correctedSnapshot,
    candidate: {
      title: "担心时间不够",
      eventNarrative: "我并没有生气，只是担心时间不够。",
      insights: []
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-EVT-005",
    suite: "event_journal",
    family: "denied_fact_preserved",
    rationale: "用户的否定表达可以原样进入事件叙事。",
    snapshot: createEventSnapshot({
      eventId: "event-denied",
      facts: [
        {
          id: "fact-denied",
          statement: "这次沟通没有让我觉得被忽视。",
          stance: "denied"
        }
      ]
    }),
    candidate: {
      title: "这次沟通",
      eventNarrative: "这次沟通没有让我觉得被忽视。",
      insights: []
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-EVT-006",
    suite: "event_journal",
    family: "deprioritized_fact_excluded",
    rationale: "退出主线的事实不进入当前事件成果。",
    snapshot: createEventSnapshot({
      eventId: "event-focus",
      facts: [
        { id: "fact-focus", statement: "我今天完成了项目汇报。" },
        {
          id: "fact-background",
          statement: "去年我也做过一次类似汇报。",
          deprioritized: true
        }
      ]
    }),
    candidate: {
      title: "完成项目汇报",
      eventNarrative: "我今天完成了项目汇报。",
      insights: []
    },
    expected: { accepted: true, issueSubset: [] }
  },
  {
    id: "BCO-EVT-007",
    suite: "event_journal",
    family: "fact_fabrication",
    rationale: "日志不能补写用户尚未表达的后续决定。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "下午开会时，我把边界说清楚，后来决定辞职离开这座城市。",
      insights: []
    },
    expected: { accepted: false, issueSubset: ["narrative_not_grounded"] }
  },
  {
    id: "BCO-EVT-008",
    suite: "event_journal",
    family: "event_cross_contamination",
    rationale: "另一件事的内容不能串入当前事件。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "晚上回家以后，我和家人因为旅行安排争吵了很久。",
      insights: []
    },
    expected: { accepted: false, issueSubset: ["narrative_not_grounded"] }
  },
  {
    id: "BCO-EVT-009",
    suite: "event_journal",
    family: "ignored_correction",
    rationale: "被纠正退出的旧事实不能继续进入日志。",
    snapshot: correctedSnapshot,
    candidate: {
      title: "方案被否定",
      eventNarrative: "我因为方案被否定而生气。",
      insights: []
    },
    expected: { accepted: false, issueSubset: ["narrative_not_grounded"] }
  },
  {
    id: "BCO-EVT-010",
    suite: "event_journal",
    family: "psychological_diagnosis",
    rationale: "事件日志不能替用户做心理诊断。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "下午开会时，我把边界说清楚，这说明我患有焦虑症。",
      insights: []
    },
    expected: {
      accepted: false,
      issueSubset: ["narrative_not_grounded", "unsupported_diagnosis"]
    }
  },
  {
    id: "BCO-EVT-011",
    suite: "event_journal",
    family: "coercive_advice",
    rationale: "成果正文保持记录语气，不给出强制建议。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "下午开会时，我把边界说清楚。我必须马上和同事断绝来往。",
      insights: []
    },
    expected: {
      accepted: false,
      issueSubset: ["narrative_not_grounded", "unsupported_advice"]
    }
  },
  {
    id: "BCO-EVT-012",
    suite: "event_journal",
    family: "internal_structure_exposure",
    rationale: "用户正文不出现内部字段和结构名称。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "JournalEvent 的 eventId 记录了我下午开会时说清边界。",
      insights: []
    },
    expected: {
      accepted: false,
      issueSubset: ["narrative_not_grounded", "internal_term"]
    }
  },
  {
    id: "BCO-EVT-013",
    suite: "event_journal",
    family: "unsupported_number",
    rationale: "日志不能新增用户未表达的数字。",
    snapshot: meetingSnapshot,
    candidate: {
      title: "把边界说清楚",
      eventNarrative: "下午开会时，我把边界说清楚，轻松了80%。",
      insights: []
    },
    expected: {
      accepted: false,
      issueSubset: ["unsupported_number"]
    }
  },
  {
    id: "BCO-EVT-014",
    suite: "event_journal",
    family: "unknown_outcome",
    rationale: "线索必须指向当前事件已完成的角度成果。",
    snapshot: outcomeSnapshot,
    candidate: {
      title: "汇报前的检查",
      eventNarrative: "汇报前，我反复检查了三遍材料。",
      insights: [
        {
          sourceOutcomeId: "outcome-other-event",
          text: "我很在意别人是否认可我。"
        }
      ]
    },
    expected: {
      accepted: false,
      issueSubset: ["unknown_outcome", "missing_eligible_outcome"]
    }
  },
  {
    id: "BCO-EVT-015",
    suite: "event_journal",
    family: "missing_eligible_outcome",
    rationale: "已有可信角度成果时，同页日志要完整呈现。",
    snapshot: outcomeSnapshot,
    candidate: {
      title: "汇报前的检查",
      eventNarrative: "汇报前，我反复检查了三遍材料。",
      insights: []
    },
    expected: { accepted: false, issueSubset: ["missing_eligible_outcome"] }
  },
  {
    id: "BCO-EVT-016",
    suite: "event_journal",
    family: "stable_personality_inference",
    rationale: "一次事件不能被扩写成稳定人格结论。",
    snapshot: outcomeSnapshot,
    candidate: {
      title: "汇报前的检查",
      eventNarrative: "汇报前，我反复检查了三遍材料。",
      insights: [
        {
          sourceOutcomeId: "outcome-thought",
          text: "我天生就是一个追求完美的人。"
        }
      ]
    },
    expected: {
      accepted: false,
      issueSubset: ["insight_not_grounded", "unsupported_stable_inference"]
    }
  }
];
