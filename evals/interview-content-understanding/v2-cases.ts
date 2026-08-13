import type { AnswerState, EventRelation } from "@/features/interview/content-understanding";
import type { InterviewOperationRequest } from "@/features/interview/intent/intent-v1";
import type { InterviewDimension } from "@/types/interview";

type OperationType = InterviewOperationRequest["type"];

export interface OrderedOperationEvalCase {
  id: string;
  family: "ordered_operations";
  rawText: string;
  expectedTypes: OperationType[];
  expectedContent: string | null;
}

export interface MultiTargetEvalCase {
  id: string;
  family: "multi_target";
  rawText: string;
  responses: Array<{
    target:
      | "event_anchor"
      | "reaction_evidence"
      | "insight_evidence"
      | "judgment_clue"
      | "kind_action"
      | "seen_need"
      | "gratitude_reason"
      | "relationship_signal";
    state: Exclude<AnswerState, "unaddressed">;
    evidenceText: string;
  }>;
}

export interface HistoryUpdateEvalCase {
  id: string;
  family: "history_update";
  dimension: InterviewDimension;
  field: string;
  oldText: string;
  newText: string;
  variant: "replace" | "retract" | "ambiguous_conflict" | "confirm_pending";
}

export interface EventRelationEvalCase {
  id: string;
  family: "event_relation";
  dimension: InterviewDimension;
  rawText: string;
  relation: EventRelation;
  relationship: "cause" | "consequence" | "contrast" | "example" | null;
  candidateDimension: InterviewDimension | null;
}

export interface ContinuityEvalCase {
  id: string;
  family: "continuity";
  variant:
    | "same_turn_replay"
    | "persisted_result_replay"
    | "pending_excluded"
    | "retracted_excluded"
    | "incomplete_protected"
    | "provider_failure_protected";
}

export type TurnUnderstandingV2EvalCase =
  | OrderedOperationEvalCase
  | MultiTargetEvalCase
  | HistoryUpdateEvalCase
  | EventRelationEvalCase
  | ContinuityEvalCase;

const orderedOperationCases: OrderedOperationEvalCase[] = [
  {
    id: "CU2-OP-001",
    family: "ordered_operations",
    rawText: "先跳过这个问题，今天同事帮我改了方案，然后直接生成日志吧。",
    expectedTypes: ["skip_question", "generate_journal"],
    expectedContent: "今天同事帮我改了方案"
  },
  {
    id: "CU2-OP-002",
    family: "ordered_operations",
    rawText: "今天先到这里，再把这些整理成日志吧。",
    expectedTypes: ["stop_follow_up", "generate_journal"],
    expectedContent: null
  },
  {
    id: "CU2-OP-003",
    family: "ordered_operations",
    rawText: "这个问题说简单点，再跳过这个问题吧。",
    expectedTypes: ["adjust_question", "skip_question"],
    expectedContent: null
  },
  {
    id: "CU2-OP-004",
    family: "ordered_operations",
    rawText: "换一件事，等我说完再生成日志。",
    expectedTypes: ["switch_event", "generate_journal"],
    expectedContent: null
  },
  {
    id: "CU2-OP-005",
    family: "ordered_operations",
    rawText: "切到感谢维度，然后直接生成日志吧。",
    expectedTypes: ["switch_dimension", "generate_journal"],
    expectedContent: null
  },
  {
    id: "CU2-OP-006",
    family: "ordered_operations",
    rawText: "先生成日志吧，后面不要再追问了。",
    expectedTypes: ["generate_journal", "stop_follow_up"],
    expectedContent: null
  },
  {
    id: "CU2-OP-007",
    family: "ordered_operations",
    rawText: "先跳过这个问题，下一个问题也跳过吧。",
    expectedTypes: ["skip_question", "skip_question"],
    expectedContent: null
  },
  {
    id: "CU2-OP-008",
    family: "ordered_operations",
    rawText: "同事说“直接生成日志吧”，我想先跳过这个问题。",
    expectedTypes: ["skip_question"],
    expectedContent: "同事说“直接生成日志吧”"
  },
  {
    id: "CU2-OP-009",
    family: "ordered_operations",
    rawText: "我当时很委屈，这个问题换个问法，然后把这些整理成日志吧。",
    expectedTypes: ["adjust_question", "generate_journal"],
    expectedContent: "我当时很委屈"
  },
  {
    id: "CU2-OP-010",
    family: "ordered_operations",
    rawText: "先换一个片段，后面再切到思考维度。",
    expectedTypes: ["switch_event", "switch_dimension"],
    expectedContent: null
  }
];

const multiTargetCases: MultiTargetEvalCase[] = [
  {
    id: "CU2-TARGET-001",
    family: "multi_target",
    rawText: "她帮我改了方案，但我不确定她是否理解我的压力。",
    responses: [
      { target: "kind_action", state: "answered", evidenceText: "她帮我改了方案" },
      { target: "seen_need", state: "uncertain", evidenceText: "我不确定她是否理解我的压力" }
    ]
  },
  {
    id: "CU2-TARGET-002",
    family: "multi_target",
    rawText: "我记得当时很轻松，原因一时想不起来。",
    responses: [
      { target: "reaction_evidence", state: "answered", evidenceText: "当时很轻松" },
      { target: "insight_evidence", state: "recall_unavailable", evidenceText: "原因一时想不起来" }
    ]
  },
  {
    id: "CU2-TARGET-003",
    family: "multi_target",
    rawText: "具体对话确实没有，心里倒是很踏实。",
    responses: [
      { target: "event_anchor", state: "explicit_absence", evidenceText: "具体对话确实没有" },
      { target: "reaction_evidence", state: "answered", evidenceText: "心里倒是很踏实" }
    ]
  },
  {
    id: "CU2-TARGET-004",
    family: "multi_target",
    rawText: "她接走了核对工作，为什么珍惜这段关系我不想说。",
    responses: [
      { target: "kind_action", state: "answered", evidenceText: "她接走了核对工作" },
      { target: "gratitude_reason", state: "declined", evidenceText: "为什么珍惜这段关系我不想说" }
    ]
  },
  {
    id: "CU2-TARGET-005",
    family: "multi_target",
    rawText: "事情是把方案交了，值不值得我现在还不确定。",
    responses: [
      { target: "event_anchor", state: "answered", evidenceText: "把方案交了" },
      { target: "judgment_clue", state: "uncertain", evidenceText: "值不值得我现在还不确定" }
    ]
  },
  {
    id: "CU2-TARGET-006",
    family: "multi_target",
    rawText: "我看见了三个人理解不同，新的判断还没想清。",
    responses: [
      { target: "event_anchor", state: "answered", evidenceText: "三个人理解不同" },
      { target: "judgment_clue", state: "uncertain", evidenceText: "新的判断还没想清" }
    ]
  },
  {
    id: "CU2-TARGET-007",
    family: "multi_target",
    rawText: "我回答得太快，下一次怎么做暂时想不起来。",
    responses: [
      { target: "insight_evidence", state: "answered", evidenceText: "我回答得太快" },
      { target: "judgment_clue", state: "recall_unavailable", evidenceText: "下一次怎么做暂时想不起来" }
    ]
  },
  {
    id: "CU2-TARGET-008",
    family: "multi_target",
    rawText: "我知道她做了什么，关系里的意义先不回答。",
    responses: [
      { target: "kind_action", state: "answered", evidenceText: "我知道她做了什么" },
      { target: "relationship_signal", state: "declined", evidenceText: "关系里的意义先不回答" }
    ]
  },
  {
    id: "CU2-TARGET-009",
    family: "multi_target",
    rawText: "当时没有明显情绪，但这件事确实改变了我的判断。",
    responses: [
      { target: "reaction_evidence", state: "explicit_absence", evidenceText: "没有明显情绪" },
      { target: "judgment_clue", state: "answered", evidenceText: "改变了我的判断" }
    ]
  },
  {
    id: "CU2-TARGET-010",
    family: "multi_target",
    rawText: "她看见我很累，也帮我理清了优先级，关系规律我还不确定。",
    responses: [
      { target: "seen_need", state: "answered", evidenceText: "她看见我很累" },
      { target: "kind_action", state: "answered", evidenceText: "帮我理清了优先级" },
      { target: "relationship_signal", state: "uncertain", evidenceText: "关系规律我还不确定" }
    ]
  }
];

const historyUpdateCases: HistoryUpdateEvalCase[] = [
  { id: "CU2-HISTORY-001", family: "history_update", dimension: "joy", field: "joySource", oldText: "因为被认可", newText: "因为被需要", variant: "replace" },
  { id: "CU2-HISTORY-002", family: "history_update", dimension: "fulfillment", field: "progressEvidence", oldText: "完成了整份方案", newText: "只完成了预算部分", variant: "replace" },
  { id: "CU2-HISTORY-003", family: "history_update", dimension: "reflection", field: "whyItMattered", oldText: "因为目标不清", newText: "这条判断先收回", variant: "retract" },
  { id: "CU2-HISTORY-004", family: "history_update", dimension: "gratitude", field: "seenNeed", oldText: "她看见我很累", newText: "这点先不算", variant: "retract" },
  { id: "CU2-HISTORY-005", family: "history_update", dimension: "joy", field: "joySource", oldText: "因为被认可", newText: "也许因为被需要", variant: "ambiguous_conflict" },
  { id: "CU2-HISTORY-006", family: "history_update", dimension: "improvement", field: "frictionPoint", oldText: "回答太快", newText: "也许是准备不足", variant: "ambiguous_conflict" },
  { id: "CU2-HISTORY-007", family: "history_update", dimension: "joy", field: "joySource", oldText: "因为被认可", newText: "因为被需要", variant: "confirm_pending" },
  { id: "CU2-HISTORY-008", family: "history_update", dimension: "gratitude", field: "seenNeed", oldText: "需要减轻压力", newText: "需要有人理清优先级", variant: "confirm_pending" }
];

const eventRelationCases: EventRelationEvalCase[] = [
  { id: "CU2-EVENT-001", family: "event_relation", dimension: "joy", rawText: "上周一直加班，所以今天这十分钟格外轻松。", relation: "linked_scene", relationship: "cause", candidateDimension: null },
  { id: "CU2-EVENT-002", family: "event_relation", dimension: "reflection", rawText: "后来返工了一次，这是目标没对齐的后果。", relation: "linked_scene", relationship: "consequence", candidateDimension: null },
  { id: "CU2-EVENT-003", family: "event_relation", dimension: "fulfillment", rawText: "相比上次停在草稿，这次已经交付。", relation: "linked_scene", relationship: "contrast", candidateDimension: null },
  { id: "CU2-EVENT-004", family: "event_relation", dimension: "improvement", rawText: "比如今天先复述问题后，回答就没有跑偏。", relation: "linked_scene", relationship: "example", candidateDimension: null },
  { id: "CU2-EVENT-005", family: "event_relation", dimension: "joy", rawText: "另外晚上沿河散了半小时步。", relation: "candidate_event", relationship: null, candidateDimension: "joy" },
  { id: "CU2-EVENT-006", family: "event_relation", dimension: "gratitude", rawText: "我也发现自己以后要更早求助。", relation: "current_detail", relationship: null, candidateDimension: "improvement" }
];

const continuityCases: ContinuityEvalCase[] = [
  { id: "CU2-CONT-001", family: "continuity", variant: "same_turn_replay" },
  { id: "CU2-CONT-002", family: "continuity", variant: "persisted_result_replay" },
  { id: "CU2-CONT-003", family: "continuity", variant: "pending_excluded" },
  { id: "CU2-CONT-004", family: "continuity", variant: "retracted_excluded" },
  { id: "CU2-CONT-005", family: "continuity", variant: "incomplete_protected" },
  { id: "CU2-CONT-006", family: "continuity", variant: "provider_failure_protected" }
];

export const turnUnderstandingV2EvalCases: TurnUnderstandingV2EvalCase[] = [
  ...orderedOperationCases,
  ...multiTargetCases,
  ...historyUpdateCases,
  ...eventRelationCases,
  ...continuityCases
];

export const TURN_UNDERSTANDING_V2_EVAL_CASE_COUNT = turnUnderstandingV2EvalCases.length;
