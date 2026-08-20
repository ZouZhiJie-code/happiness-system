import {
  eventCenteredGenerativePlanSchema,
  eventCenteredLockedGenerativeVisibleSchema,
  eventCenteredProviderGenerativeTurnSchema,
  eventCenteredGenerativeTurnSchema,
  eventCenteredTwoStageV4GenerativePlanSchema,
  eventCenteredNaturalResponseSchema,
  eventCenteredUnderstandingDecisionSchema,
  isEventCenteredGenerativeAnchorTraceable,
  isEventCenteredGenerativeImmediateFallbackIssue,
  partitionEventCenteredGenerativeValidationIssues,
  validateEventCenteredGenerativeTurn,
  validateEventCenteredGenerativeSemanticPlan,
  validateEventCenteredEvidenceQuotes,
  validateEventCenteredHypothesisAlignment,
  validateEventCenteredOutcomeAlignment,
  validateEventCenteredResponsePresentation,
  type EventCenteredQuestionIntent,
  type EventCenteredSemanticFrame,
  type EventCenteredSemanticLimitReason,
  type EventCenteredSemanticQuestionIntent,
  type EventCenteredUnderstandingCard,
  type EventCenteredGenerativeTurn,
  type EventCenteredLockedGenerativeVisibleResult,
  type EventCenteredProviderGenerativeTurn,
  type EventCenteredTwoStageV4ProviderPlan,
  type EventCenteredNaturalResponse,
  type EventCenteredUnderstandingDecision
} from "@/features/interview/event-centered/ai-contract";
import {
  EVENT_CENTERED_ANGLE_CARD_VERSION,
  EVENT_CENTERED_ANGLE_STRATEGY_CARDS,
  EVENT_CENTERED_FEW_SHOT_VERSION,
  EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
  EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS,
  getEventCenteredGenerativeMode,
  selectEventCenteredFewShots,
  type EventCenteredCognitiveAction
} from "@/features/interview/event-centered/generative-strategy";
import { hasEventCenteredUnableAnswerSignal } from "@/features/interview/event-centered/generative-turn-policy";
import {
  GENERATIVE_QUALITY_CALIBRATION_CARDS,
  GENERATIVE_QUALITY_CALIBRATION_VERSION
} from "@/features/interview/event-centered/generative-quality-calibration";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_VERSION
} from "@/features/interview/event-centered/complete-response-first";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION,
  buildEventCenteredCompleteResponseFirstV12Messages,
  eventCenteredCompleteResponseFirstV12OutputSchema,
  projectEventCenteredCompleteResponseFirstV12Turn,
  validateEventCenteredCompleteResponseFirstV12Output,
  type EventCenteredCompleteResponseFirstV12Output
} from "@/features/interview/event-centered/complete-response-first-v1-2";
import { isEventCenteredThoughtOnlyScope } from "@/features/interview/event-centered-release";
import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import type { AIProvider } from "@/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "@/server/services/ai/event-centered-provider";
import {
  completeStructuredOutput,
  type StructuredOutputAttempt
} from "@/server/services/ai/structured-output";
import {
  getEventCenteredFirstCheckpointPresentation,
  removeRepeatedEventCenteredQuestionAnchor,
  resolveEventCenteredNaturalUnderstanding
} from "@/features/interview/event-centered/turn-quality";
import {
  resolveEventCenteredFocusOptions,
  splitEventCenteredSourceGroups
} from "@/features/interview/event-centered/event-focus-options";
import type {
  EventCenteredAssistantPayload,
  EventCenteredCurrentQuestionIntent,
  EventCenteredDialoguePhase,
  EventCenteredQuestionSurface,
  EventCenteredResponseKind
} from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";
import {
  thoughtMapModelUpdateSchema,
  thoughtQuestionExpressionSchema,
  type ThoughtMapProviderOutput,
  type ThoughtQuestionExpression
} from "@/features/interview/event-centered/thought-ai-contract";
import type {
  ThoughtProtocolState,
  ThoughtQuestionPlan
} from "@/features/interview/event-centered/thought-judgment-map";

export const EVENT_CENTERED_UNDERSTANDING_PROMPT_VERSION = "2026-07-25.event-centered-v2";
export const EVENT_CENTERED_RESPONSE_PROMPT_VERSION = "2026-07-25.event-centered-v2";
export const EVENT_CENTERED_GENERATIVE_TURN_PROMPT_VERSION =
  "2026-08-04.event-centered-thought-pilot-v85-gi066-fix";
export const EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION =
  "2026-08-04.event-centered-thought-pilot-v85-gi066-fix";
export const EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION =
  "2026-08-04.event-centered-thought-pilot-v85-gi066-fix-visible";
export const EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION =
  "event-centered-semantic-plan.v17";

/**
 * 两段式输出的真实内容远小于此前的 1500 token 上限。分别收紧上限，
 * 保留完整语义骨架与一至两句思路层，减少模型等待和冗长输出风险。
 */
export const EVENT_CENTERED_SEMANTIC_PLAN_MAX_TOKENS = 820;
export const EVENT_CENTERED_VISIBLE_TURN_MAX_TOKENS = 420;

const UNKNOWN_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前|确实|真的|实在))?(?:不知道(?:[^，,。！？!?；;]{0,18})?|不清楚(?:[^，,。！？!?；;]{0,18})?|想不起来|记不清(?:了)?|说不清(?:楚)?|(?:这些|那些|这几个|那几个)?都不贴切|没法再具体(?:说|讲|描述)?|无法再具体(?:说|讲|描述)?)(?:了|啊|呀|呢|吧)?[。！!？?]?$/u;
/**
 * 文本访谈里，这些表达已经足够说明用户希望结束当前展开。
 * MVP 不猜测用户是在“暂时想不起来”还是“还可以被说服”，直接收束，
 * 保留已记录内容并回到检查点。
 */
const STOP_PATTERN = /^(?:我)?(?:不想回答|不想答|不想选|不想继续(?:聊|问|追问)?(?:这个)?|(?:想|要)?停下来|不继续(?:聊|问|追问)(?:这个)?|先停(?:一下|下|在这里)?|别问(?:了)?|不聊(?:了)?|不用再追问|(?:先|就先)?收(?:在|到)?这里|暂时不想(?:说|聊)|到这里就好)(?:了|啊|呀|呢|吧)?[。！!？?]?$/u;
const STOP_CLAUSE_PATTERN = /^(?:我)?(?:(?:先)?别(?:再)?(?:继续)?(?:问|追问)(?:了|这个)?|不要再追问|先到这里|先停(?:一下|下|在这里)?|到这里(?:就)?好|(?:想|先)停(?:一下|下|在这里)?|不想继续(?:聊|说|回答|问|追问)?)(?:了|啊|呀|呢|吧)?$/u;
const CONTINUE_CLAUSE_PATTERN = /^(?:但|不过|可是)?(?:我)?(?:还|仍然|还是)?(?:想|可以|愿意)继续(?:聊|说|回答)?/u;
const STANDALONE_DENIAL_PATTERN = /^(?:我)?(?:(?:当时|现在|目前|确实|真的|其实)\s*)?(?:并)?没有(?:[^，,。！？!?；;]{0,18})?(?:了|啊|呀|呢|吧)?[。！!？?]?$/u;
const EXPLICIT_CORRECTION_PATTERNS = [
  /(?:我|先)?纠正(?:一下)?/u,
  /我(?:刚才)?说错了/u,
  /(?:你|刚才|前面).{0,12}(?:理解|说|记|写).{0,4}(?:错了|不对)/u,
  /^不对(?:[，,。！!]|$)/u,
  /^(?:我)?不是(?:这个意思|我说的|这样)(?:[，,。！!]|$)/u,
  /^(?:我)?不是[^，,。！？!?；;]{1,24}[，,](?:而)?是/u,
  /^(?:我)?应该是/u,
  /(?:还)?不确定是|还不能说是/u,
  /刚才.*别算/u
] as const;
const BARE_CORRECTION_PREFIX_PATTERN = /^(?:我)?不是[，,]\s*(.+)$/u;
const INNER_EXPERIENCE_PATTERN = /(开心|高兴|难受|生气|委屈|失望|紧张|害怕|焦虑|放松|轻松|疲惫|累|在意|担心|内疚|愧疚|成就感|自豪|满足|踏实|松了一口气|松口气)/u;
const ADVICE_REQUEST_PATTERN = /(怎么办|怎么做|有什么建议|给我.*建议|你建议)/u;
const FALLBACK_EVENT_ANCHOR_PATTERN = /(?:被[^，,。！？!?；;]{1,24}(?:了|过|到|得)|(?:跟|和|与)[^，,。！？!?；;]{1,16}(?:玩|说|聊|开会|见|吃|走|相处)|(?:开会|会议|汇报|发言|说明|提交|处理|完成|开始|取消|打断|咬|联系|回复|回应|帮助|拒绝|答应|整理|准备|安排|发生|遇到|看到|听到|收到|做了)[^，,。！？!?；;]{0,24}|(?:对方|同事|朋友|伴侣|家人|他|她).{0,20}(?:说|问|回复|回应|打断|联系|帮助|拒绝|答应|笑)[^，,。！？!?；;]{1,24})/u;
const PERSONAL_REACTION_START_PATTERN = /(?:我(?:当时|现在|后来|也|还|一直|其实|一度)?(?:有点|很|特别|挺|十分|感到|感觉|觉得|担心|害怕|在意|希望|想要|想|需要|认为|判断|不安|难受|生气|委屈|内疚|愧疚|有成就感|有点成就感|松了一口气|松口气)|(?:心里|心情|脑子|思绪).{0,4}(?:乱|很|有点|感到|觉得|担心)|这(?:件事|一下|让我).{0,12}(?:感到|觉得|很|有点))/u;

export type EventCenteredResponseDirective = Pick<
  EventCenteredAssistantPayload,
  "responseKind" | "questionSpec" | "checkpoint" | "angleOutcome"
> & {
  exactResponse: string;
};

export type EventCenteredAIGenerationResult = {
  decision: EventCenteredUnderstandingDecision;
  response: EventCenteredNaturalResponse;
  payload: EventCenteredAssistantPayload;
  outputOrigin: "llm" | "deterministic" | "fallback";
  attempts: StructuredOutputAttempt[];
  promptLineage: Array<{
    promptKey: string;
    promptVersion: string;
    resolvedPromptHash: string;
  }>;
};

export type EventCenteredUnderstandingGenerationResult = Pick<
  EventCenteredAIGenerationResult,
  "decision" | "outputOrigin" | "attempts" | "promptLineage"
>;

export type EventCenteredResponseGenerationResult = Pick<
  EventCenteredAIGenerationResult,
  "response" | "payload" | "outputOrigin" | "attempts" | "promptLineage"
>;

export type EventCenteredGenerativeRecentTurn = {
  user: string;
  assistantUnderstanding: string;
  assistantQuestion: string | null;
  assistantResponse?: string;
  assistantMessageId?: string;
};

export type EventCenteredGenerativeArchitecture = "one_call" | "two_call";

export type EventCenteredGenerativeGenerationInput = {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  currentQuestionTarget: string | null;
  currentQuestionIntent?: EventCenteredCurrentQuestionIntent | null;
  currentQuestionSurfaceLevel?: EventCenteredQuestionSurface | null;
  currentQuestionCognitiveAction: EventCenteredCognitiveAction | null;
  /** 显式“纠正理解”操作由系统提供；普通文本仍使用高置信纠正规则。 */
  correctionRequested?: boolean;
  /** 显式纠正操作指向的当前分支助手消息；v1.2 只用于来源校验。 */
  correctionTargetAssistantMessageId?: string | null;
  facts: JournalEventFactRecord[];
  recentTurns: EventCenteredGenerativeRecentTurn[];
  askedTargets: string[];
  answeredTargets: string[];
  deniedTargets: string[];
  guidedQuestionOpportunityCount: number;
  microgoal: {
    statement: string;
    questionCount: number;
    answerCount?: number;
    status: "active" | "completed" | "closed";
    evidenceRefs: string[];
  } | null;
  priorAngleOutcome?: {
    id: string;
    statement: string;
    supportFactIds: string[];
  } | null;
  /** 隔离 v1.1：同一调用负责完整可见回应，并继续提交最小状态。 */
  completeResponseFirst?: boolean;
  provider?: AIProvider | null;
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 定向修复时携带本地校验原因，不改变用户事实、角度和来源边界。 */
  retryIssues?: string[];
  /**
   * 离线评测的预算账本在每次第一段技术尝试结束后结算。主业务不传此回调，
   * 继续沿用既有调用路径。
   */
  onSemanticAttemptResult?: (input: {
    attemptIndex: number;
    success: boolean;
    validationIssues: string[];
    artifact: EventCenteredGenerativeSemanticPlanArtifact | null;
  }) => Promise<void> | void;
  onRetry?: (input: {
    stage: "semantic" | "visible";
    attempt: 1;
    reasonCodes: string[];
  }) => Promise<void> | void;
};

export type EventCenteredGenerativeGenerationResult = {
  turn: EventCenteredGenerativeTurn | null;
  semanticArtifact: EventCenteredGenerativeSemanticPlanArtifact | null;
  outputOrigin: "llm" | "deterministic" | "fallback";
  attempts: StructuredOutputAttempt[];
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
  validationIssues: string[];
  qualityDiagnostics: string[];
  strategyVersion: string;
  angleCardVersion: string;
  fewShotVersion: string;
  fewShotIds: string[];
  architecture: EventCenteredGenerativeArchitecture;
  /** v1.2 单一可见负责人生成的原样正文；页面投影不得再次拼接或改写。 */
  completeResponseText?: string;
  /** v1.2 最小结构只进入私有运行 Trace 与确定性保存映射。 */
  completeResponseEnvelope?: EventCenteredCompleteResponseFirstV12Output;
};

export type EventCenteredGenerativeSemanticPlanArtifact = {
  artifactVersion: typeof EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION;
  inputBinding: {
    phase: EventCenteredDialoguePhase;
    activeAngle: JournalEventAngle | null;
    currentQuestionTarget: string | null;
    planPromptHash: string;
    semanticPlanHash: string;
    /** 语义层定向修复使用的本地校验码，用于表达层复算同一计划指纹。 */
    retryIssues?: string[];
  };
  understanding: EventCenteredGenerativeTurn["understanding"];
  decisionState: EventCenteredTwoStageV4ProviderPlan["decision"]["state"];
  decisionOrigin: EventCenteredTwoStageV4ProviderPlan["decision"]["origin"];
  decisionProgressAssessment:
    EventCenteredTwoStageV4ProviderPlan["decision"]["progressAssessment"];
  semanticFrame: EventCenteredSemanticFrame | null;
  providerQuestionIntent: EventCenteredSemanticQuestionIntent | null;
  providerLimitReason: EventCenteredSemanticLimitReason | null;
  /** 下游与历史 Trace 的确定性兼容投影；第二段表达层禁止读取。 */
  understandingCard: EventCenteredUnderstandingCard | null;
  questionIntent: EventCenteredQuestionIntent | null;
  limitReason: string | null;
  semanticPlan: EventCenteredGenerativeTurn["semanticPlan"];
  evidenceStatements: Array<{
    ref: string;
    statement: string;
    sourceText: string;
  }>;
  strategyVersion: string;
  angleCardVersion: string;
  fewShotVersion: string;
  fewShotIds: string[];
  promptVersion: typeof EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION;
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
};

export type EventCenteredThoughtMapGenerationResult = {
  update: ThoughtMapProviderOutput | null;
  attempts: StructuredOutputAttempt[];
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
  validationIssues: string[];
  repaired: boolean;
};

export type EventCenteredThoughtQuestionGenerationResult = {
  expression: ThoughtQuestionExpression | null;
  attempts: StructuredOutputAttempt[];
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
  validationIssues: string[];
  repaired: boolean;
};

function thoughtProtocolPromptProjection(protocol: ThoughtProtocolState) {
  return {
    targets: Object.fromEntries(Object.entries(protocol.targets).map(([direction, target]) => [
      direction,
      {
        status: target.status,
        sourceRefs: target.sourceRefs,
        relationKey: target.relationKey
      }
    ])),
    currentDirection: protocol.currentDirection,
    directionQuestionCount: protocol.directionQuestionCount,
    currentQuestionSignature: protocol.currentPlan?.signature ?? null,
    resolvedDemands: protocol.resolvedDemands.map((item) => ({
      demandKey: item.demandKey,
      direction: item.direction,
      status: item.status,
      sourceRefs: item.sourceRefs
    })),
    invalidatedSourceRefs: protocol.invalidatedSourceRefs,
    invalidatedRelationKeys: protocol.invalidatedRelationKeys,
    invalidatedOutcomeIds: protocol.invalidatedOutcomeIds
  };
}

export async function generateEventCenteredThoughtMapUpdateAI(input: {
  rawText: string;
  protocol: ThoughtProtocolState;
  facts: JournalEventFactRecord[];
  recentTurns: EventCenteredGenerativeRecentTurn[];
  correctionRequested: boolean;
  provider?: AIProvider | null;
  signal?: AbortSignal;
}): Promise<EventCenteredThoughtMapGenerationResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];
  const envelope = createPromptEnvelope({
    promptKey: "interview.event_centered.thought_map_update",
    promptVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
    messages: [
      {
        role: "system",
        content: [
          "你只更新理清想法的有限判断地图和来源。只输出 JSON。",
          "最外层只允许 eventBoundary、answerStatus、factDeltas、targetUpdates、routeSignals、relationCandidate、correction。任何 ask、complete、pause、action、question、questionIntent、answerEntry、thinkingSummary、用户可见文案或结束理由都会导致失败。",
          "严格使用以下 JSON 形状，字段类型和英文枚举不得改写：{\"eventBoundary\":\"current_event\",\"answerStatus\":\"complete\",\"factDeltas\":[],\"targetUpdates\":[],\"routeSignals\":{\"dualEvidence\":false,\"competingGoals\":false,\"explicitRuleOrAssumption\":false,\"newEvidenceOrUncertainty\":false,\"sourceRefs\":[],\"conditionKeys\":[]},\"relationCandidate\":null,\"correction\":null}。eventBoundary 只能是 current_event/background/another_event/multiple_events/unclear；answerStatus 只能是 complete/partial/denied/unclear/correction/unrelated。",
          "factDeltas 每项严格为 statement、scope、stance、kind、quote；scope 只能 current_event/background，stance 只能 affirmed/denied/unknown。targetUpdates 必须是数组，routeSignals 必须是上例对象；缺少内容时使用空数组、false 或 null，禁止省略和改成字符串。",
          "七个方向固定为 current_judgment、judgment_basis、judgment_criterion、default_assumption、evidence_tension、tradeoff_condition、judgment_calibration。模型只把本轮明确材料更新为 partial、answered、denied 或 unclear；closed、invalidated 和最终动作由系统决定。",
          "factDeltas.quote 必须逐字来自 rawText。本轮来源依次使用 new:1、new:2；已有事实只能引用输入中的 id。不得新增人物、动作、数字、引语、因果、他人动机、人格或价值判断。",
          "routeSignals 只识别可观察信号：双侧证据、竞争目标、明确规则或前提、新证据或判断动摇。conditionKeys 使用短小稳定语义键，不能写问题句。",
          "relationCandidate 每轮最多一条，必须有至少两个不同来源。relationKey 必须是一句可独立理解的自然中文关系，不得使用内部编号、下划线键或标签。user_articulated 只用于用户已经明确说出的关系；ai_synthesized 只允许当前事件内的条件、支持/削弱、张力、取舍或校准关系。",
          "纠正优先。correctionRequested 或用户明确纠正时 answerStatus=correction。correction.kind 固定四类：用户纠正事实或判断填 fact_or_judgment；用户指出已经回答、问题重复填 answer_coverage；用户否定问题前提填 question_premise；用户只增加信息填 supplement。fact_or_judgment 才列出真正失效的来源、关系、成果；其余类型可使用空失效数组，但 affectedDirections 必须包含当前问题方向。",
          "回答判定必须对照 currentQuestionSignature：用户已经覆盖期待关系时填 complete；只回答一部分时填 partial，targetUpdates 只保留仍缺的具体部分；明确否定问题前提时填 denied；明确说不清时填 unclear。resolvedDemands 已经关闭的认识需求不得重新打开。",
          "用户指出重复提问时，关闭已经回答的认识需求并重新选题。用户否定判断发生变化时，禁止把纠正本身当成新证据或判断转变。用户同时停止时只保留边界信号，服务端负责停止。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
          artifactVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
          correctionRequested: input.correctionRequested,
          protocol: thoughtProtocolPromptProjection(input.protocol),
          effectiveFacts: input.facts.map((fact) => ({
            id: fact.id,
            statement: fact.statement,
            stance: fact.stance,
            kind: fact.kind,
            sourceQuote: latestTraceableFactSourceQuote(fact)
          })),
          recentTurns: input.recentTurns.slice(-3),
          rawText: input.rawText
        })
      }
    ]
  });
  let update: ThoughtMapProviderOutput | null = null;
  let sourceRefsRepaired = false;
  for (let attemptIndex = 0; attemptIndex < 2 && !update; attemptIndex += 1) {
    const previousIssue = attempts.at(-1)?.errorMessage;
    let candidate = await completeStructuredOutput<ThoughtMapProviderOutput>({
      provider,
      stage: "extract",
      schema: thoughtMapModelUpdateSchema,
      messages: previousIssue
        ? [
            ...envelope.messages,
            {
              role: "system",
              content: `定向修复：上一版校验失败（${previousIssue}）。保持事实边界不变；quote 必须逐字截取 rawText，sourceRefs 只能使用已有事实 id 或与 factDeltas 顺序对应的 new:1、new:2；同时按规定 JSON 形状、字段类型和英文枚举重写。`
            }
          ]
        : envelope.messages,
      temperature: 0.2,
      maxTokens: 900,
      maxAttempts: 1,
      timeoutMs: 12_000,
      responseFormat: "json_object",
      thinking: "disabled",
      signal: input.signal,
      onAttempt: (attempt) => {
        attempts.push(attempt);
      }
    });
    if (!candidate) continue;
    const candidateValidSourceRefs = new Set([
      ...input.facts.map((fact) => fact.id),
      ...Object.values(input.protocol.targets).flatMap((target) => target.sourceRefs),
      ...Array.from({ length: candidate.factDeltas.length }, (_, index) => `new:${index + 1}`)
    ]);
    {
      const safeRefs = (refs: string[]) => refs.filter((ref) => candidateValidSourceRefs.has(ref));
      const assertedRefs = [
        ...candidate.targetUpdates.flatMap((target) => target.sourceRefs),
        ...candidate.routeSignals.sourceRefs,
        ...(candidate.relationCandidate?.sourceRefs ?? [])
      ];
      if (assertedRefs.some((ref) => !candidateValidSourceRefs.has(ref))) {
        sourceRefsRepaired = true;
      }
      const relationRefs = candidate.relationCandidate
        ? safeRefs(candidate.relationCandidate.sourceRefs)
        : [];
      const targetUpdates = candidate.targetUpdates.flatMap((target) => {
        const refs = safeRefs(target.sourceRefs);
        return refs.length > 0 ? [{ ...target, sourceRefs: refs }] : [];
      });
      const routeSourceRefs = safeRefs(candidate.routeSignals.sourceRefs);
      candidate = {
        ...candidate,
        targetUpdates,
        routeSignals: {
          ...candidate.routeSignals,
          sourceRefs: routeSourceRefs,
          dualEvidence: routeSourceRefs.length > 0 && candidate.routeSignals.dualEvidence,
          competingGoals: routeSourceRefs.length > 0 && candidate.routeSignals.competingGoals,
          explicitRuleOrAssumption: routeSourceRefs.length > 0 &&
            candidate.routeSignals.explicitRuleOrAssumption,
          newEvidenceOrUncertainty: routeSourceRefs.length > 0 &&
            candidate.routeSignals.newEvidenceOrUncertainty
        },
        relationCandidate: candidate.relationCandidate && relationRefs.length >= 2
          ? { ...candidate.relationCandidate, sourceRefs: relationRefs }
          : null,
        correction: input.correctionRequested && candidate.correction
          ? {
              ...candidate.correction,
              invalidatedSourceRefs: candidate.correction.invalidatedSourceRefs.filter((ref) =>
                candidateValidSourceRefs.has(ref)
              ),
              invalidatedRelationKeys: candidate.correction.invalidatedRelationKeys.filter((key) =>
                input.protocol.invalidatedRelationKeys.includes(key) ||
                Object.values(input.protocol.targets).some((target) => target.relationKey === key)
              ),
              invalidatedOutcomeIds: candidate.correction.invalidatedOutcomeIds.filter((id) =>
                input.protocol.invalidatedOutcomeIds.includes(id)
              )
            }
          : null
      };
    }
    const sourceIssues = [
      ...(candidate.factDeltas.some((fact) => !input.rawText.includes(fact.quote))
        ? ["THOUGHT_MAP_SOURCE_QUOTE_MISMATCH"]
        : []),
      ...[
        ...candidate.targetUpdates.flatMap((target) => target.sourceRefs),
        ...candidate.routeSignals.sourceRefs,
        ...(candidate.relationCandidate?.sourceRefs ?? [])
      ].some((ref) => !candidateValidSourceRefs.has(ref))
        ? ["THOUGHT_MAP_UNKNOWN_SOURCE_REF"]
        : []
    ];
    if (sourceIssues.length === 0) {
      update = candidate;
      continue;
    }
    const lastAttempt = attempts.at(-1);
    if (lastAttempt) {
      lastAttempt.success = false;
      lastAttempt.errorCode = sourceIssues[0] ?? "THOUGHT_MAP_SOURCE_VALIDATION_FAILED";
      lastAttempt.errorMessage = sourceIssues.join(";");
    }
  }
  const validationIssues: string[] = [];
  if (!update) {
    validationIssues.push(
      attempts.at(-1)?.errorCode ?? "THOUGHT_MAP_OUTPUT_UNAVAILABLE",
      "THOUGHT_MAP_OUTPUT_UNAVAILABLE"
    );
  }
  const validSourceRefs = new Set([
    ...input.facts.map((fact) => fact.id),
    ...Object.values(input.protocol.targets).flatMap((target) => target.sourceRefs),
    ...input.rawText
      ? Array.from({ length: update?.factDeltas.length ?? 0 }, (_, index) => `new:${index + 1}`)
      : []
  ]);
  if (update && /(?:说不清|讲不清|分不清|想不出来)/u.test(input.rawText)) {
    const safeRefs = (refs: string[]) => refs.filter((ref) => validSourceRefs.has(ref));
    const relationRefs = update.relationCandidate
      ? safeRefs(update.relationCandidate.sourceRefs)
      : [];
    update = {
      ...update,
      targetUpdates: update.targetUpdates.map((target) => ({
        ...target,
        sourceRefs: safeRefs(target.sourceRefs)
      })),
      routeSignals: {
        ...update.routeSignals,
        sourceRefs: safeRefs(update.routeSignals.sourceRefs)
      },
      relationCandidate: update.relationCandidate && relationRefs.length >= 2
        ? { ...update.relationCandidate, sourceRefs: relationRefs }
        : null
    };
  }
  update?.factDeltas.forEach((fact) => {
    if (!input.rawText.includes(fact.quote)) {
      validationIssues.push("THOUGHT_MAP_SOURCE_QUOTE_MISMATCH");
    }
  });
  const assertedSourceRefs = update
    ? [
        ...update.targetUpdates.flatMap((target) => target.sourceRefs),
        ...update.routeSignals.sourceRefs,
        ...(update.relationCandidate?.sourceRefs ?? [])
      ]
    : [];
  if (assertedSourceRefs.some((ref) => !validSourceRefs.has(ref))) {
    validationIssues.push("THOUGHT_MAP_UNKNOWN_SOURCE_REF");
  }
  return {
    update: validationIssues.length === 0 ? update : null,
    attempts,
    promptLineage: [{
      promptKey: envelope.promptKey,
      promptVersion: envelope.promptVersion,
      resolvedPromptHash: envelope.resolvedPromptHash
    }],
    validationIssues: [...new Set(validationIssues)],
    repaired: sourceRefsRepaired
  };
}

function thoughtExpressionQualityIssues(input: {
  expression: ThoughtQuestionExpression;
  plan: ThoughtQuestionPlan;
  sourceEvidence: Array<{ ref: string; sourceText: string }>;
}) {
  const issues: string[] = [];
  const summary = normalizeText(input.expression.thinkingSummary);
  const question = normalizeText(input.expression.question);
  if (/^(?:你提到|你说|刚才你)/u.test(summary)) {
    issues.push("THOUGHT_SUMMARY_RESTATES_USER");
  }
  if (/(?:判断地图|目标编号|质量门|内部流程|系统选题|sourceRefs)/iu.test(`${summary}${question}`)) {
    issues.push("THOUGHT_EXPRESSION_EXPOSES_INTERNAL_STRUCTURE");
  }
  if (hasUnquotedFirstPersonExpression(`${summary}。${question}`)) {
    issues.push("THOUGHT_EXPRESSION_USES_USER_FIRST_PERSON");
  }
  if (input.sourceEvidence.some(({ sourceText }) => {
    const source = normalizeText(sourceText);
    return source.length >= 8 && summary.includes(source);
  })) {
    issues.push("THOUGHT_SUMMARY_REPEATS_SOURCE");
  }
  if (
    input.plan.operation === "single_variable_contrast" &&
    !/(?:如果|假如|假设|只改|只看|其他不变|在.{0,20}(?:情况下|条件下|前提下)|当.{0,16}时|没有|不再|改成|换成|变成|会不会|还会|是否仍|达到.{0,10}(?:程度|标准)|到什么程度|怎样的程度|多大程度|才会|足以)/u.test(question)
  ) {
    issues.push("THOUGHT_QUESTION_MISSES_SINGLE_VARIABLE_CONTRAST");
  }
  if (
    input.plan.operation === "specific_instance" &&
    !/(?:当时|那次|具体|哪|什么|哪个|一句|一个|回到|时刻|瞬间|场景|情形|时候|回应|反应|怎么|怎样)/u.test(question)
  ) {
    issues.push("THOUGHT_QUESTION_MISSES_SPECIFIC_ENTRY");
  }
  return issues;
}

export async function generateEventCenteredThoughtQuestionAI(input: {
  plan: ThoughtQuestionPlan;
  sourceEvidence: Array<{ ref: string; sourceText: string }>;
  correctionRequested: boolean;
  provider?: AIProvider | null;
  signal?: AbortSignal;
}): Promise<EventCenteredThoughtQuestionGenerationResult> {
  if (input.plan.action !== "ask" || !input.plan.signature) {
    return {
      expression: null,
      attempts: [],
      promptLineage: [],
      validationIssues: ["THOUGHT_QUESTION_PLAN_NOT_ASK"],
      repaired: false
    };
  }
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];
  const lineage: EventCenteredAIGenerationResult["promptLineage"] = [];
  let retryIssues: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const envelope = createPromptEnvelope({
      promptKey: "interview.event_centered.thought_question_visible",
      promptVersion: EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION,
      messages: [
        {
          role: "system",
          content: [
            "你只表达系统冻结的问题计划。只输出 thinkingSummary 和 question 两个 JSON 字段。",
            "thinkingSummary 用一至两句说明当前看见的条件、张力、区别、取舍或校准，以及下一问为什么值得确认。question 只问一个具体、低负担的问题。",
            "thinkingSummary 首句直接写判断关系或认识缺口；首字不得使用‘你’，开头不得使用‘你提到’、‘你说’或‘刚才你’。只写理解增量，禁止复述来源内容。",
            "不得改变 action、direction、operation、coreConditionKey、expectedRelation、来源或问题目标；不得输出成果、建议、结束动作和其他字段。",
            "禁止原话引用、同义复述、事实堆叠、问题改写、答案预告、第一人称冒用、内部术语、新人物、新动作、新结果、无来源因果和正确答案暗示。",
            "single_variable_contrast 只改变已有的一个条件，并允许回答都重要、都不是、还要看其他条件或说不清。specific_instance 回到已有来源里的具体时刻或判断瞬间。",
            ...(input.correctionRequested
              ? ["本轮承接纠正：思路只说明理解已调整以及新问题的价值，旧理解不得出现。"]
              : []),
            ...(retryIssues.length > 0
              ? [`定向重写：上一版失败码为 ${retryIssues.join("、")}。问题计划和签名保持冻结，只修复表达。`]
              : [])
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            frozenPlan: {
              planHash: input.plan.planHash,
              direction: input.plan.direction,
              operation: input.plan.operation,
              signature: input.plan.signature,
              expectedDelta: input.plan.expectedDelta,
              summaryJob: input.plan.summaryJob,
              questionJob: input.plan.questionJob
            },
            sourceEvidence: input.sourceEvidence.filter((item) =>
              input.plan.sourceRefs.includes(item.ref)
            )
          })
        }
      ]
    });
    lineage.push({
      promptKey: envelope.promptKey,
      promptVersion: envelope.promptVersion,
      resolvedPromptHash: envelope.resolvedPromptHash
    });
    const expression = await completeStructuredOutput<ThoughtQuestionExpression>({
      provider,
      stage: "question",
      schema: thoughtQuestionExpressionSchema,
      messages: envelope.messages,
      temperature: 0.2,
      maxTokens: 420,
      maxAttempts: 1,
      timeoutMs: 12_000,
      responseFormat: "json_object",
      thinking: "disabled",
      signal: input.signal,
      onAttempt: (attempt) => {
        attempts.push(attempt);
      }
    });
    if (!expression) {
      retryIssues = ["THOUGHT_EXPRESSION_OUTPUT_UNAVAILABLE"];
      continue;
    }
    retryIssues = thoughtExpressionQualityIssues({
      expression,
      plan: input.plan,
      sourceEvidence: input.sourceEvidence
    });
    if (retryIssues.length === 0) {
      return {
        expression,
        attempts,
        promptLineage: uniqueGenerativePromptLineage(lineage),
        validationIssues: [],
        repaired: index > 0
      };
    }
  }
  return {
    expression: null,
    attempts,
    promptLineage: uniqueGenerativePromptLineage(lineage),
    validationIssues: [...new Set(retryIssues)],
    repaired: false
  };
}

export type EventCenteredGenerativeSemanticPlanStageResult = {
  artifact: EventCenteredGenerativeSemanticPlanArtifact | null;
  outputOrigin: "llm" | "deterministic" | "fallback";
  attempts: StructuredOutputAttempt[];
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
  validationIssues: string[];
  qualityDiagnostics: string[];
  strategyVersion: string;
  angleCardVersion: string;
  fewShotVersion: string;
  fewShotIds: string[];
  architecture: "two_call";
};

export type EventCenteredGenerativeVisibleStageResult =
  EventCenteredGenerativeGenerationResult & {
    artifact: EventCenteredGenerativeSemanticPlanArtifact;
  };

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function isExplicitEventCenteredCorrection(rawText: string) {
  const normalized = normalizeText(rawText);
  if (EXPLICIT_CORRECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  const continuation = BARE_CORRECTION_PREFIX_PATTERN.exec(normalized)?.[1]?.trim();
  if (!continuation) return false;
  const semanticLength = Array.from(
    continuation.replace(/[\s\p{P}\p{S}]+/gu, "")
  ).length;
  return semanticLength >= 3 &&
    !isStandaloneUnknownExpression(continuation) &&
    !containsActiveStopClause(continuation);
}

function completeRealizationClauses(value: string) {
  return normalizeText(value)
    .split(/[，,。！？!?；;]+/u)
    .map((clause) => clause.trim())
    .filter((clause) => Array.from(clause).length >= 2 && Array.from(clause).length <= 280);
}

function resolveSystemRealizationAnchor(input: {
  rawText: string;
  facts: JournalEventFactRecord[];
  boundaryDetected: boolean;
}) {
  const clauses = normalizeText(input.rawText)
    .split(/[，,。！？!?；;]+/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const boundaryClause = input.boundaryDetected
    ? [...clauses].reverse().find((clause) =>
        STOP_PATTERN.test(clause) || STOP_CLAUSE_PATTERN.test(clause)
      )
    : null;
  const sources = [
    boundaryClause,
    input.rawText,
    ...input.facts.map((fact) => fact.statement)
  ].filter((value): value is string => Boolean(value));
  return sources
    .flatMap(completeRealizationClauses)
    .find((anchor) => Array.from(anchor).length >= 2) ?? "当前内容";
}

function hasNarrativeContinuation(value: string) {
  return /[，,；;\n]|(?:但|可是|不过|所以|因为|后来|然后|同时|而且)/u.test(value);
}

function isStandaloneUnknownExpression(rawText: string) {
  const normalized = normalizeText(rawText);
  return UNKNOWN_PATTERN.test(normalized) && !hasNarrativeContinuation(normalized);
}

function isStandaloneDenialExpression(rawText: string) {
  const normalized = normalizeText(rawText);
  return STANDALONE_DENIAL_PATTERN.test(normalized) && !hasNarrativeContinuation(normalized);
}

function containsActiveStopClause(rawText: string) {
  const clauses = normalizeText(rawText)
    .split(/[，,。！？!?；;]+/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
  let lastStopIndex = -1;
  let lastContinueIndex = -1;
  clauses.forEach((clause, index) => {
    if (STOP_PATTERN.test(clause) || STOP_CLAUSE_PATTERN.test(clause)) lastStopIndex = index;
    if (CONTINUE_CLAUSE_PATTERN.test(clause)) lastContinueIndex = index;
  });
  return lastStopIndex >= 0 && lastStopIndex > lastContinueIndex;
}

/**
 * 纯文本中无法可靠区分“暂时想不起来”与“希望结束”。MVP 将明确的
 * 否定或无法继续表达统一视为边界；纠正表达由更高优先级的修订链处理。
 */
export function isEventCenteredTextBoundaryExpression(rawText: string) {
  const normalized = normalizeText(rawText);
  return Boolean(normalized) && (
    isStandaloneUnknownExpression(normalized) ||
    containsActiveStopClause(normalized) ||
    isStandaloneDenialExpression(normalized)
  );
}

function hasAvailableGenerativeUnableAnswerRepair(
  input: Pick<
    EventCenteredGenerativeGenerationInput,
    "rawText" | "currentQuestionTarget" | "currentQuestionSurfaceLevel"
  >
) {
  return Boolean(input.currentQuestionTarget) &&
    hasEventCenteredUnableAnswerSignal(input.rawText) &&
    (
      input.currentQuestionSurfaceLevel === "open_anchor" ||
      input.currentQuestionSurfaceLevel === "simplified"
    );
}

function isGenerativeTextBoundaryExpression(
  input: Pick<
    EventCenteredGenerativeGenerationInput,
    "rawText" | "currentQuestionTarget" | "currentQuestionSurfaceLevel"
  >
) {
  return isEventCenteredTextBoundaryExpression(input.rawText) &&
    !hasAvailableGenerativeUnableAnswerRepair(input);
}

function boundaryFallbackFact(rawText: string) {
  const normalized = normalizeText(rawText);
  const isSpecificDenial = isStandaloneDenialExpression(normalized);
  return {
    statement: normalized,
    scope: "current_event" as const,
    stance: isSpecificDenial ? "denied" as const : "unknown" as const,
    kind: INNER_EXPERIENCE_PATTERN.test(normalized)
      ? "inner_experience" as const
      : "boundary_answer" as const,
    quote: rawText.trim()
  };
}

/**
 * 在模型理解之后加上的确定性产品边界。它不会改写纠正轮；对具体否定
 * 补一条原话可追溯的 denied 事实，避免“我没有生气”在收束时丢失。
 */
export function enforceEventCenteredTextBoundaryDecision(input: {
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
}): EventCenteredUnderstandingDecision {
  const normalized = normalizeText(input.rawText);
  if (
    !isEventCenteredTextBoundaryExpression(normalized) ||
    input.decision.answerSignal === "correction" ||
    isExplicitEventCenteredCorrection(normalized)
  ) {
    return input.decision;
  }

  const hasSpecificDenial = isStandaloneDenialExpression(normalized);
  const hasDeniedFact = input.decision.facts.some((fact) =>
    fact.stance === "denied" && fact.quote.includes("没有")
  );
  const facts = hasSpecificDenial && !hasDeniedFact
    ? [...input.decision.facts.slice(0, 5), boundaryFallbackFact(input.rawText)]
    : input.decision.facts.length > 0
      ? input.decision.facts
      : [boundaryFallbackFact(input.rawText)];

  return {
    ...input.decision,
    coreEventIdentifiable: false,
    answerSignal: "declined",
    facts,
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    eventOptions: []
  };
}

function fallbackEventOptions(rawText: string) {
  return resolveEventCenteredFocusOptions({ rawText }) ?? [];
}

/**
 * 事件记录阶段不调用模型。这里从用户原话中保留一段明确的个人反应，
 * 供后续在双事件选定焦点后继续使用；原话片段仍由当前 UserTurn 持有。
 */
export function extractEventCenteredPersonalReactionFact(rawText: string) {
  const source = rawText.trim();
  const match = PERSONAL_REACTION_START_PATTERN.exec(source);
  if (!match || match.index === undefined) return null;

  const afterStart = source.slice(match.index);
  const boundary = afterStart.search(/[。！？!?；;]/u);
  const quote = (boundary >= 0 ? afterStart.slice(0, boundary) : afterStart).trim();
  const statement = normalizeText(quote);
  if (Array.from(statement).length < 2) return null;

  return {
    statement,
    scope: "current_event" as const,
    stance: "affirmed" as const,
    kind: "inner_experience" as const,
    quote
  };
}

function fallbackEventRecordingFacts(input: {
  rawText: string;
  normalized: string;
  coreEventIdentifiable: boolean;
  unknown: boolean;
  stopped: boolean;
  textBoundary: boolean;
}) {
  if (!input.normalized) return [];
  if (input.unknown || input.stopped || input.textBoundary) {
    return [{
      statement: input.normalized,
      scope: "current_event" as const,
      stance: input.normalized.includes("没有") || input.stopped
        ? "denied" as const
        : "unknown" as const,
      kind: "boundary_answer" as const,
      quote: input.rawText
    }];
  }

  const facts: EventCenteredUnderstandingDecision["facts"] = [];
  if (input.coreEventIdentifiable) {
    facts.push({
      statement: input.normalized,
      scope: "current_event",
      stance: "affirmed",
      kind: "event_detail",
      quote: input.rawText
    });
  }
  const personalReaction = extractEventCenteredPersonalReactionFact(input.rawText);
  if (personalReaction) facts.push(personalReaction);
  return facts;
}

function fallbackDecision(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
}): EventCenteredUnderstandingDecision {
  const rawText = input.rawText.trim();
  const normalized = normalizeText(rawText);
  const unknown = isStandaloneUnknownExpression(normalized);
  const stopped = containsActiveStopClause(normalized);
  const textBoundary = isEventCenteredTextBoundaryExpression(normalized);
  const correction = isExplicitEventCenteredCorrection(normalized);
  const multipleEvents = splitEventCenteredSourceGroups(rawText).length === 2;
  const personalReaction = extractEventCenteredPersonalReactionFact(rawText);
  const hasEventAnchor = FALLBACK_EVENT_ANCHOR_PATTERN.test(normalized);
  const coreEventIdentifiable = Boolean(
    normalized.length >= 4 &&
      !textBoundary &&
      !STOP_PATTERN.test(normalized) &&
      (!personalReaction || hasEventAnchor)
  );

  return {
    eventBoundary: multipleEvents ? "multiple_events" : "current_event",
    coreEventIdentifiable: multipleEvents ? false : coreEventIdentifiable,
    answerSignal: correction
      ? "correction"
      : textBoundary
        ? "declined"
        : unknown
          ? "unknown"
          : coreEventIdentifiable
            ? "answered"
            : "partly_answered",
    facts: multipleEvents
      ? []
      : fallbackEventRecordingFacts({
          rawText,
          normalized,
          coreEventIdentifiable,
          unknown,
          stopped,
          textBoundary
        }),
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: ADVICE_REQUEST_PATTERN.test(normalized)
      ? { requested: true, condition: null, options: [] }
      : null,
    eventOptions: multipleEvents ? fallbackEventOptions(rawText) : [],
    correctionTargetHint: null,
    boundaryReason: multipleEvents ? "表达中出现了两件并列事件，需要用户选择当前主线。" : null
  };
}

function buildUnderstandingMessages(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  facts: JournalEventFactRecord[];
}) {
  const factLines = input.facts.map((fact) => ({
    id: fact.id,
    statement: fact.statement,
    scope: fact.scope,
    stance: fact.stance,
    kind: fact.kind
  }));
  return [
    {
      role: "system" as const,
      content: [
        "你负责事件中心访谈的证据判断，只输出 JSON。",
        "用户原话是最高依据。事实 quote 必须逐字出现在本轮原话中。",
        "当前事件、解释当前事件的背景、另一独立事件必须分开。",
        "两件并列事件在用户选择前不建立事实。",
        "每轮最多一个缺少原话支持的可能性推测；轻量记录与纠正轮禁止推测。",
        "准确复述不算角度成果，成果需要形成有证据的新增区分。",
        "角度成果默认只描述当前这次事件；只有原话明确包含总是、每次、通常、经常等重复性证据时，才可以概括稳定规律。",
        "用户明确求行动建议时标记 adviceRequest；先澄清一个取舍条件。当前问题正在询问该条件时，用回答填写 condition，并给2到3个带取舍的非强制备选。",
        "不诊断、不替用户归因、不推测他人动机、不主动给建议。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        phase: input.phase,
        activeAngle: input.activeAngle,
        currentQuestion: input.currentQuestion,
        effectiveFacts: factLines,
        rawText: input.rawText,
        outputSchema: {
          eventBoundary: "current_event|background|another_event|multiple_events|unclear",
          coreEventIdentifiable: "boolean",
          answerSignal: "answered|partly_answered|unknown|declined|correction|unrelated",
          facts: "[{statement,scope,stance,kind,quote}]",
          angleEvidence: "[{angle,evidence,valueAddedInsightPossible}]",
          outcomeCandidate: "null|{angle,kind,statement,supportFactStatements}",
          unsupportedHypothesis: "null|{statement,scope,stance,kind}",
          adviceRequest: "null|{requested:true,condition:string|null,options:[{text,tradeoff}]}",
          eventOptions: "仅当multiple_events时输出最多两项[{label,sourceText}]；sourceText必须是用户原话中的连续短摘录",
          correctionTargetHint: "string|null",
          boundaryReason: "string|null"
        }
      })
    }
  ];
}

function buildResponseMessages(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  decision: EventCenteredUnderstandingDecision;
  directive: EventCenteredResponseDirective;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你负责把已经确定的访谈策略写成自然、克制、容易回答的中文，只输出 JSON。",
        "理解层简短呈现 AI 此刻怎样理解用户，不重复堆叠原话。",
        "自然理解已经承接事件事实时，问题直接进入提问目标，避免再次用‘你提到’重复同一句事实。",
        "策略给出的提问、检查点和成果内容必须原样保留，模型不能改变阶段和问题目标。",
        "每条回复只让用户完成一个动作：回答一个问题，或点击一张纸笺。自然理解只能承接和说明，不能包含问号、追问或选择指令。",
        "当 fixedDirective 是检查点时，自然回应只做一句承接，不能提问；检查点纸笺会呈现后续动作。",
        "当 fixedDirective 是纸笺选择时，自然回应只做一句承接，不能提问、要求选择或复述选项；纸笺会承载选择。",
        "普通追问只围绕 fixedDirective 中唯一的问题目标，不能附带第二个问题。",
        `普通第一检查点的自然理解只承接用户原话中的核心事件；纠正或明确否定轮只承接已经识别的变化。自然回应简短确认已记下，两层文字不能完全相同。不要补写感受、意义、需要、动机、后果、规律或角度洞见。`,
        "自然理解直接对用户说话，禁止使用‘用户提到／用户描述／用户表达’等后台观察口吻。",
        "自然理解中的可能性推测必须与 hypothesisStatement 完全一致。",
        "不诊断、不说教、不主动建议、不暴露事实表、槽位、状态机等内部结构。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        rawText: input.rawText,
        phase: input.phase,
        activeAngle: input.activeAngle,
        understandingDecision: input.decision,
        fixedDirective: input.directive,
        outputSchema: {
          naturalUnderstanding: "string",
          naturalResponse: "string",
          hypothesisStatement: "string|null",
          outcomeStatement: "string|null"
        }
      })
    }
  ];
}


function getUserSemanticSignals(rawText: string) {
  const normalizedRawText = normalizeText(rawText);
  return {
    explicitUnderstanding: /我(?:才)?发现|我(?:才)?意识到|我明白|说明|区别(?:就在|是)|关键(?:是|在)|真正.{0,12}是|其实.{0,12}是|才算|就不算|不等于|等于/u.test(normalizedRawText),
    explicitJudgmentRule: /才算|就不算|等于|不等于|判断.{0,8}(?:依据|标准)|标准(?:是|在)/u.test(normalizedRawText),
    explicitExpectationOrBoundary: /我(?:期待|希望|需要|想要|想保留)|对我来说.{0,16}(?:边界|重要)/u.test(normalizedRawText),
    explicitTradeoff: /宁愿.{0,24}也不|代价是|压过了?|哪怕.{0,24}也/u.test(normalizedRawText),
    explicitActionFunction: /(?:为了|用来|让我|使我|帮我|保护|恢复|维持|避免|有理由).{0,24}/u.test(normalizedRawText)
  };
}

function buildRuntimeQualityCalibrationReference(
  qualityCalibration: (typeof GENERATIVE_QUALITY_CALIBRATION_CARDS)[number] | null,
  mode: ReturnType<typeof getEventCenteredGenerativeMode>
) {
  if (!qualityCalibration) return null;
  return {
    angle: qualityCalibration.angle,
    mode: qualityCalibration.mode,
    statePatterns: [
      {
        outcomeState: "needs_more",
        outcomeOrigin: null,
        expectedAction: "ask",
        thinkingSummaryRole: "说明 AI 此刻怎样理解用户问题、关键矛盾或认识缺口，以及聚焦该方向的原因；禁止复述用户原话，问题另行提供具体作答入口。",
        mainResponseRole: "只问一个能改变当前理解、容易回答的问题。"
      },
      {
        outcomeState: "ready",
        outcomeOrigin: "user_articulated",
        expectedAction: mode === "deep" ? "pause" : "complete",
        thinkingSummaryRole: "固定为空；停止轮只呈现一段正式回应。",
        mainResponseRole: "忠实保存用户已经形成的成果；界面不新增 AI 气泡，直接进入第二检查点。"
      },
      {
        outcomeState: "ready",
        outcomeOrigin: "ai_synthesized",
        expectedAction: mode === "deep" ? "pause" : "complete",
        thinkingSummaryRole: "固定为空；停止轮只呈现一段正式回应。",
        mainResponseRole: "用至少两条证据形成用户尚未说出的事件内关系；新增内容只取区别、先后、条件、可观察结果或实际影响。"
      },
      {
        outcomeState: "limited",
        outcomeOrigin: null,
        expectedAction: "honest_limit",
        thinkingSummaryRole: "固定为空；停止轮只呈现一段正式回应。",
        mainResponseRole: "自然说明当前能确认到哪里，不制造认识。"
      }
    ]
  };
}

function buildV4SemanticFewShotReferences(
  examples: ReturnType<typeof selectEventCenteredFewShots>
) {
  const selected = [
    examples.find((example) => example.kind === "positive_user_articulated"),
    examples.find((example) => example.kind === "positive_ai_synthesized"),
    examples.find((example) => example.kind === "positive_ask"),
  ].filter((example): example is (typeof examples)[number] => Boolean(example));
  const unique = [...new Map(selected.map((example) => [example.id, example])).values()]
    .slice(0, 3);
  return unique.map((example) => {
    const currentClauses = example.currentUserText
      .split(/[，,。！!？?；;]+/u)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 3);
    const exampleEvidence = [
      ...currentClauses.map((statement, index) => ({
        ref: `new:${index + 1}`,
        statement,
        sourceText: statement
      })),
      ...(normalizeText(example.userContext)
        ? [{
            ref: "existing:1",
            statement: normalizeText(example.userContext),
            sourceText: normalizeText(example.userContext)
          }]
        : [])
    ];
    const currentEvidenceRefs = exampleEvidence
      .filter((item) => item.ref.startsWith("new:"))
      .map((item) => item.ref);
    const frameEvidenceRefs = exampleEvidence.slice(
      0,
      Math.max(1, Math.min(2, exampleEvidence.length))
    ).map((item) => item.ref);
    const shared = {
      id: example.id,
      angle: example.angle,
      mode: example.mode,
      kind: example.kind,
      currentQuestion: example.currentQuestion,
      userContext: example.userContext,
      currentUserText: example.currentUserText,
      evidenceCatalog: exampleEvidence,
      guidance: example.kind === "positive_ask"
        ? `${example.guidance} 作答入口要比认识目标低一个抽象层，让用户只用当前事件里的一个小片段就能直接回答。`
        : example.guidance
    };
    const exampleUnderstanding = {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: example.kind === "positive_ask" ? "partly_answered" : "answered",
      factDeltas: currentClauses.map((statement) => ({
        statement,
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: statement
      })),
      correctionOrBoundary: null,
      eventOptions: []
    };
    const currentMainEvidenceRefs = currentEvidenceRefs.length > 0
      ? currentEvidenceRefs
      : exampleEvidence.slice(0, 1).map((item) => item.ref);
    const questionGapByAngle: Record<JournalEventAngle, string> = {
      feeling: "补清体验发生变化的具体时刻",
      thought: "补清当前判断所依据的直接比较",
      relationship: "补清互动中能够确认变化的原话",
      action: "补清动作前后可观察到的具体变化"
    };
    const answerSourceKindByAngle: Record<
      JournalEventAngle,
      EventCenteredSemanticQuestionIntent["answerSource"]["kind"]
    > = {
      feeling: "change_moment",
      thought: "direct_comparison",
      relationship: "exact_words",
      action: "observable_action"
    };
    const unitRoleByAngle: Record<
      JournalEventAngle,
      EventCenteredSemanticFrame["units"][number]["role"]
    > = {
      feeling: "experience",
      thought: "judgment",
      relationship: "result",
      action: "change"
    };
    const units: EventCenteredSemanticFrame["units"] = frameEvidenceRefs.map(
      (ref, index) => ({
        id: `u${index + 1}` as "u1" | "u2",
        role: index === 0 ? "event" : unitRoleByAngle[example.angle],
        evidenceRefs: [ref]
      })
    );
    const semanticFrame: EventCenteredSemanticFrame = {
      units,
      relation: units.length >= 2
        ? {
            type: "coexistence",
            fromUnitId: units[0]!.id,
            toUnitId: units[1]!.id
          }
        : null
    };
    const answerSourceRefs = currentMainEvidenceRefs.slice(0, 1);
    const answerSourceAnchor = exampleEvidence.find((item) =>
      item.ref === answerSourceRefs[0]
    )?.sourceText ?? currentClauses[0] ?? normalizeText(example.currentUserText);
    return {
      ...shared,
      expectedOutput: example.kind === "positive_ask"
        ? {
            understanding: exampleUnderstanding,
            decision: {
              state: "needs_more",
              origin: null,
              progressAssessment: example.mode === "deep"
                ? "no_increment"
                : "not_applicable"
            },
            semanticFrame,
            questionIntent: {
              gap: questionGapByAngle[example.angle],
              answerSource: {
                kind: answerSourceKindByAngle[example.angle],
                evidenceRefs: answerSourceRefs,
                anchorQuote: answerSourceAnchor
              }
            },
            limitReason: null
          }
        : {
            understanding: exampleUnderstanding,
            decision: {
              state: "ready",
              origin: example.kind === "positive_ai_synthesized"
                ? "ai_synthesized"
                : "user_articulated",
              progressAssessment: example.mode === "deep"
                ? example.kind === "positive_ai_synthesized"
                  ? "ai_new_relation"
                  : "user_new_understanding"
                : "not_applicable"
            },
            semanticFrame,
            questionIntent: null,
            limitReason: null
          }
    };
  });
}

function getCurrentAngleDecisionRule(
  angle: JournalEventAngle | null,
  mode: ReturnType<typeof getEventCenteredGenerativeMode>
) {
  if (angle === "feeling" && mode === "guided") {
    return "感受角度引导复盘：用户完整回答当前目标时忠实整理。用户给出明确身体或行为信号时，可以就地自然化为紧张、放松、害怕、生气、难过、开心、疲惫等常见低推断感受词，来源仍标 user_articulated；具体信号必须同时保留。超出常见词或涉及原因、需要、意义时继续询问。";
  }
  if (angle === "feeling" && mode === "deep") {
    return "感受角度深度聊天：用户说出的在意、意义或边界可以进入成果；明确身体或行为信号可就地自然化为常见低推断感受词并继续标 user_articulated。AI 综合只连接至少两条不同、相关、可观察证据；原因、需要、意义或边界仍缺时沿具体时刻、身体变化或原词补问。";
  }
  if (angle === "thought" && mode === "guided") {
    return "想法角度引导复盘：用户完整回答当前判断目标时忠实整理且不评价其合理性；判断原因和标准只使用用户原话，AI 综合只连接可观察证据。";
  }
  if (angle === "thought" && mode === "deep") {
    return "想法角度深度聊天：用户说出的默认规则、证据冲突、内部矛盾或判断范围可以进入成果；AI 综合只连接至少两条可观察证据，并保留证据双方。";
  }
  if (angle === "relationship" && mode === "guided") {
    return "关系角度引导复盘：用户完整回答期待、位置或边界目标时忠实整理；AI 综合只连接可观察互动与实际影响。关系意义和他人动机不能由 AI 补写。";
  }
  if (angle === "relationship" && mode === "deep") {
    return "关系角度深度聊天：用户说出的信任、位置、自主、互惠或边界可以进入成果；AI 综合只连接至少两条可观察互动及实际影响。";
  }
  if (angle === "action" && mode === "guided") {
    return "行动角度引导复盘：用户完整回答动作作用时忠实整理；AI 综合只连接动作、当时条件与实际结果。行动功能仍未知且会改变当前目标理解时，围绕动作前后具体多了、少了或改变了什么提问。";
  }
  if (angle === "action" && mode === "deep") {
    return "行动角度深度聊天：用户说出的作用、保护内容、在意、动机或代价可以进入成果；AI 综合只连接至少两条可观察证据。行动动机不能由 AI 补写，未来计划保持在本轮范围外。";
  }
  return null;
}

function resolveGenerationCurrentQuestionIntent(
  input: EventCenteredGenerativeGenerationInput
) {
  if (
    !input.currentQuestionIntent ||
    !input.currentQuestionTarget ||
    input.currentQuestionIntent.targetId !== input.currentQuestionTarget
  ) {
    return null;
  }
  return input.currentQuestionIntent;
}

function buildGenerativeTurnMessages(input: EventCenteredGenerativeGenerationInput) {
  const mode = getEventCenteredGenerativeMode(input.phase);
  const thoughtPilot = isEventCenteredThoughtOnlyScope();
  const allowedActions = mode === "guided"
    ? ["ask", "complete", "honest_limit"] as const
    : mode === "deep"
      ? ["ask", "pause", "honest_limit"] as const
      : ["ask", "honest_limit"] as const;
  const anchorEvidenceGate = mode === "deep" &&
    input.currentQuestionCognitiveAction === "anchor_specific"
    ? {
        condition: "当前可见目标尚未完整回答、剩余缺口只能由用户提供、一个具体低负担补问会实质改变当前事件理解，三项同时成立",
        requiredAction: "ask",
        forbiddenActions: ["pause", "complete"],
        requiredAdvance: "沿 currentQuestionTarget 补一个具体缺口；currentMicrogoal 不新增必答层级"
      }
    : null;
  const card = input.activeAngle
    ? EVENT_CENTERED_ANGLE_STRATEGY_CARDS[input.activeAngle]
    : null;
  const runtimeAngleCard = card
    ? {
        angle: card.angle,
        minimumOutcome: card.minimumOutcome,
        directions: mode === "deep" ? card.deepDirections : card.guidedDirections,
        inferenceBoundaries: card.inferenceBoundaries,
        stopCondition: mode === "deep"
          ? `${card.completionRule} 深度聊天使用 pause；currentMicrogoal 不能追加必答层级。${card.pauseRule}`
          : card.completionRule,
        excludedDirections: card.excludedDirections
      }
    : null;
  const examples = input.activeAngle && mode
    ? selectEventCenteredFewShots({ angle: input.activeAngle, mode })
    : [];
  const calibrationMode = mode === "deep" ? "deep_conversation" : "guided_reflection";
  const qualityCalibration = input.activeAngle && mode
    ? GENERATIVE_QUALITY_CALIBRATION_CARDS.find((item) =>
        item.angle === input.activeAngle && item.mode === calibrationMode
      ) ?? null
    : null;
  const currentAngleRule = getCurrentAngleDecisionRule(input.activeAngle, mode);
  const currentQuestionIntent = resolveGenerationCurrentQuestionIntent(input);
  const userSemanticSignals = getUserSemanticSignals(input.rawText);
  const systemRules = [
    "你负责完成事件中心访谈的一次完整回合。只输出 JSON，最外层直接且仅包含 understanding、semanticPlan、visibleTurn。",
    ...(input.completeResponseFirst
      ? EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD
      : []),
    "event_recording 阶段只记录当前事件事实与用户个人反应，activeAngle 固定为 null，禁止生成角度成果、成果关系或角度 outcome；只在事件事实与个人反应共同具备时交给系统进入第一检查点。",
    "1. 用户停止、纠正和拒绝优先；这些控制一旦成立，立即执行对应边界。",
    "2. 先把 effectiveFacts 与本轮 factDeltas 合并，再判断 outcomeAssessment 和 action。factDeltas.quote 必须逐字来自 rawText；已有事实引用 id，本轮事实引用 new:N。",
    "2a. 所有枚举字段只填写一个合法值，禁止复制带竖线的说明。eventBoundary 只取 current_event、background、another_event、multiple_events、unclear；factDeltas.scope 只取 current_event 或 background。用于对照当前事件的其他经历写 scope=background，当前焦点仍是 current_event。",
    "3.【唯一分流顺序】严格依次执行：用户边界或纠正 → 用户原话已经直接说出目标关系时 user_articulated → GI-040 证据关系成立时 ai_synthesized → 同一目标满足三项条件时 ask → honest_limit。后续分支不能越过前面已经成立的分支。",
    "3a.【ask 硬分界】currentQuestionTarget 是当前可见目标的稳定编号；currentQuestionIntent.minimumAnswerScope 是当前问题是否仍可 ask 的唯一最低回答范围。minimumAnswerScope 未满足时才允许继续检查 ask；一旦满足，本轮禁止 ask。semanticGoal 只指导怎样组织已经取得的成果，不能增加用户必答层级。currentMicrogoal 只约束探索方向、允许深度与连续三问上限，也不能增加新的必答层级。",
    "3b. minimumAnswerScope 已满足后，严格三选一：用户原话已经直接说出相关关系时，origin=user_articulated；两侧事实可以在 GI-040 上限内安全连接时，origin=ai_synthesized；仍无法安全形成成果时，honest_limit。前两项立即在引导复盘 complete、深度聊天 pause。answerStatus 只表示当前问题获得材料的完整程度，不能单独决定成果来源。用户成果允许没有新洞见，只忠实连接证据与用户给出的答案；禁止加强判断、添加空泛收益或混入 AI 解释。旧状态缺少 currentQuestionIntent 时，兼容使用 currentQuestion 与 currentQuestionTarget 判断。",
    "3b-1. user_articulated 只允许忠实命题、用户明确说出的关系，以及两类限定本地自然化：把第一人称整理成面向用户的第二人称；感受角度把明确身体或行为信号自然化为常见低推断感受词并同时保留具体信号。后一类仍标 user_articulated。除此之外新增原因、需要、意义、动机、判断或关系解释时必须改判 ai_synthesized；minimumAnswerScope 未满足时才允许继续检查 ask，已满足且无法安全综合时使用 honest_limit。",
    "3c. 用户提供了当前问题需要的事实、但所需关系仍由模型连接时，先检查 ai_synthesized。至少两条不同、相关、可追溯且引用编号不重复的证据可以形成一个当前事件内证据关系；新增关系只取区别、先后、条件、可观察结果或实际影响，一次只给一条，并用 tentativeInterpretation 保存同一关系。answerStatus=answered 或 partly_answered 均不能阻止这项来源判断。",
    "3d. minimumAnswerScope 未满足时，只有三项同时成立才 ask：最低回答范围仍有明确缺口；剩余缺口只能由用户提供，现有证据不能在 GI-040 上限内安全形成成果；一个沿同一目标的具体、低负担补问会实质改变当前事件理解。任一项不成立都停止追问。",
    "3e. ask 时 outcomeAssessment.state=needs_more、origin=null、insightKind=null、tentativeInterpretation=null、stopReason=null。selectedTargetId 保持 currentQuestionTarget 的同一语义方向；answerStatus=partly_answered 只说明目标仍开放，仍需通过三项 ask 条件。",
    "3e-1. 用户表达说不清、分不清或想不到且没有拒绝时，结合 currentQuestionSurfaceLevel 决策：open_anchor 或 simplified 允许沿同一 currentQuestionTarget 使用一次 anchor_specific 的具体材料入口；系统会把它呈现为 concrete_anchor 且不增加正式问题次数。concrete_anchor 或 low_pressure_choice 表示该降压入口已经用过，继续无法说明时使用已有成果或 honest_limit，不能再 ask。",
    "3f. AI 综合不得补写用户未提供的感受标签、判断原因、关系意义或行动动机；人格、创伤、长期模式、他人动机、能力绝对判断与通用心理标签全部排除。事实顺序、并存或同义改写需要形成能改变当前事件理解的具体关系，才能成为成果。",
    "3g. 用户边界直接进入 honest_limit。用户纠正时 answerStatus=correction 且 correctionOrBoundary.kind=correction，先撤回旧理解，再用纠正后的回答继续执行 3b 至 3f；纠正本身不强制继续提问。",
    "4. 输出 origin 前核对来源：minimumAnswerScope 已满足，且相关关系能在 rawText 或 recentTurns 的用户原话中完整找到时标 user_articulated；最低范围由两侧可观察事实满足、相关关系由模型安全连接时标 ai_synthesized。semanticGoal 只指导成果组织。effectiveFacts 和 factDeltas 只证明事实存在。userSemanticSignals 只帮助定位用户可能已经说出的理解，仍需与可追溯原话对齐。",
    "5. ask 使用具体时刻、行为或选择提供一个直接作答入口，问题保持 currentQuestionTarget 的同一语义方向且不能复述 currentQuestion。问题可以借助已知时刻定位，禁止用‘你提到……’复述用户原话。原因问题必须落到一个具体时刻、行为或选择。",
    "5a. 多条线索先选最可能改变当前目标理解的方向；价值接近时跟随用户最后强调的重点。关系角度用具体互动询问用户自己的边界或判断；禁止‘处于什么位置、意味着什么、进入什么判断’等抽象分析表达。",
    "6. deniedTargets 和用户明确拒绝的语义方向退出候选。askedTargets 只记录历史，answeredTargets 记录已经取得的具体答案；目标编号和已问历史都不能单独触发继续或停止。只有当前问题与预期答案都明确重复时才算重复。",
    "7. 一次只问一个目标；禁止抽象元语言、强迫二选一和低价值细节收集。",
    ...(input.completeResponseFirst
      ? [
          "9. ask 时 thinkingSummary 与 question 将在页面合成一个气泡。thinkingSummary 使用一至两句自然承接或可纠正理解，question 只提供一个围绕新增信息目标的作答入口；两者读起来必须是一条连贯回应。",
          "9a. thinkingSummary 可以简短自然转述当前有效意思，但不能完整复述用户刚说完的内容、再次承接上一轮已经承接的纠正、罗列事实或预告问题答案。不要使用内部分析语气、候选列表、未经确认的动机和结果。"
        ]
      : [
          "9. ask 固定先呈现一至两句 thinkingSummary，再呈现一个问题。thinkingSummary 说明 AI 此刻怎样理解用户问题，指出关键矛盾、关系或认识缺口，并解释下一问聚焦该方向的原因；正式问题单独提供作答入口。",
          "9a. thinkingSummary 与问题分工表达。禁止引用或同义复述用户原话、事实罗列、问题改写、答案预告、第一人称动作叙述、候选列表、内部评分、回答提示、未经证实的动机和结果。纠正时只说明理解已按新信息调整。"
        ]),
    "10. 引导复盘形成成果用 complete；深度聊天形成认识进展用 pause；停止轮只呈现一段 insight 或 honestLimit，thinkingSummary=null。",
    "11. 材料有限、用户边界成立或继续提问价值有限时用 honest_limit，只说明当前范围，不制造认识。",
    "12. 严格遵守角度卡、allowedActions、anchorEvidenceGate、单一问题、事实可追溯、安全边界和三问上限。anchorEvidenceGate 只有三项 ask 条件同时成立时生效。认识类型只取 distinction、connection、tension、meaning、function、scope_only。",
    ...(thoughtPilot ? [
      "13.【GI-065 单角度】当前候选只做 thought。最低成果必须同时包含当前判断与一项具体判断依据；深层成果可以继续形成判断标准、默认假设、证据张力、取舍条件或判断校准。不得切换到感受、关系或行动角度。",
      "13a.【语义覆盖先行】提问期待获得的答案只要已经存在于 effectiveFacts、rawText、recentTurns 的用户回答、answeredTargets 或 priorAngleOutcome 中，就必须换一个真正未覆盖的目标；找不到合格目标时进入 complete/pause/honest_limit，禁止重复提问或同义改问。",
      "13b.【持续复盘】每个 currentMicrogoal 最多三个具体问题；整场会话可以建立多个微目标。阶段成果形成后先收为 complete/pause。用户随后继续输入时建立新微目标；用户只说继续时，从判断标准、默认假设、证据张力、取舍条件、判断校准中选择当前证据支持且价值最高的未覆盖缺口。找不到合格缺口时再次开放收束。",
      "13c.【纠正继续】用户纠正后，旧事实和受影响成果退出有效理解；使用新事实重新执行问停判断。纠正本身不能触发 complete、pause 或结束，除非同一表达还明确要求停止。"
    ] : []),
    `新回合可用认知动作：${EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS.join("、")}。`,
    ...(currentAngleRule ? [currentAngleRule] : []),
    "Few-shot 只用于学习问停边界、认知层级和表达形态；示例故事不能写入当前用户事实。"
  ];

  return {
    messages: [
      {
        role: "system" as const,
        content: systemRules.join("\n")
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
          angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
          fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
          phase: input.phase,
          mode,
          activeAngle: input.activeAngle,
          angleStrategyCard: runtimeAngleCard,
          qualityCalibrationVersion: GENERATIVE_QUALITY_CALIBRATION_VERSION,
          qualityCalibration: buildRuntimeQualityCalibrationReference(
            qualityCalibration,
            mode
          ),
          fewShotExamples: examples.map((example) => ({
            ...example,
            userSemanticSignals: getUserSemanticSignals(example.currentUserText)
          })),
          currentQuestion: input.currentQuestion,
          currentQuestionTarget: input.currentQuestionTarget,
          currentQuestionIntent,
          currentQuestionSurfaceLevel: input.currentQuestionSurfaceLevel ?? null,
          currentQuestionCognitiveAction: input.currentQuestionCognitiveAction,
          userSemanticSignals,
          allowedActions,
          anchorEvidenceGate,
          askedTargets: input.askedTargets,
          answeredTargets: input.answeredTargets,
          deniedTargets: input.deniedTargets,
          guidedQuestionOpportunityCount: input.guidedQuestionOpportunityCount,
          currentMicrogoal: input.microgoal,
          priorAngleOutcome: input.priorAngleOutcome ?? null,
          deepQuestionAnswerCount: input.microgoal?.answerCount ?? 0,
          visibleResponseMode: input.completeResponseFirst
            ? "complete_response_v1_1"
            : "split_summary_and_response",
          recentTurns: input.recentTurns.slice(input.completeResponseFirst ? -8 : -3),
          effectiveFacts: input.facts.map((fact) => ({
            id: fact.id,
            statement: fact.statement,
            scope: fact.scope,
            stance: fact.stance,
            kind: fact.kind
          })),
          rawText: input.rawText,
          responseContract: {
            understanding: {
              eventBoundary: "只填一个合法值：current_event、background、another_event、multiple_events 或 unclear",
              coreEventIdentifiable: "boolean",
              answerStatus: "answered|partly_answered|unknown|declined|correction|unrelated",
              factDeltas: "[{statement,scope:只填 current_event 或 background,stance:只填 affirmed、denied 或 unknown,kind:只填 event_detail、inner_experience、stated_interpretation、stated_preference 或 boundary_answer,quote}]",
              correctionOrBoundary: "null|{kind:correction|boundary,reason}",
              tentativeInterpretation: "null；该字段由 semanticPlan.tentativeInterpretation 同步",
              eventOptions: "multiple_events 时两项，否则 []"
            },
            semanticPlan: {
              action: allowedActions.join("|"),
              activeAngle: input.activeAngle,
              outcomeAssessment: "{state,origin,basis,supportEvidenceRefs,missingUnderstanding}；state 只填 needs_more、ready 或 limited；origin 只填 user_articulated、ai_synthesized 或 null，并按规则 3a 核对",
              evidenceRefs: "已有 fact id 或 new:N",
              insightKind: "ask 时 null；其他动作取 distinction|connection|tension|meaning|function|scope_only",
              selectedTargetId: "ask 时唯一目标，否则 null",
              expectedUnderstandingDelta: "ask 时说明预期增量；complete/pause 时记录已形成认识；honest_limit 时 null",
              tentativeInterpretation: "null|{statement,supportEvidenceRefs:[至少2项]}",
              stopReason: "停止类动作原因，ask 时 null",
              cognitiveAction: `ask 时从 ${EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS.join("|")} 选择一项，否则 null`
            },
            visibleTurn: {
              thinkingSummary: "ask 时一至两句、最多160字：展示本轮理解更新、当前优先线索及其认识价值；其他动作固定 null",
              responseKind: "question|completion|pause|honest_limit",
              question: "ask 时一个问题，否则 null",
              insight: "complete 或 pause 时阶段性认识，否则 null",
              honestLimit: "honest_limit 时诚实收束，否则 null"
            }
          }
        })
      }
    ],
    examples
  };
}

function enforceGenerativeSystemBoundaries(input: {
  turn: EventCenteredGenerativeTurn;
  rawText: string;
  activeAngle: JournalEventAngle | null;
  phase: EventCenteredDialoguePhase;
  currentQuestionTarget: string | null;
  currentQuestionSurfaceLevel?: EventCenteredQuestionSurface | null;
  guidedQuestionOpportunityCount: number;
  microgoalQuestionCount: number;
}) {
  const boundaryDetected = isGenerativeTextBoundaryExpression(input);
  const isDeep = input.phase === "deep_companionship" || input.phase === "checkpoint_two";
  const isQuestionLimitRepair = hasAvailableGenerativeUnableAnswerRepair(input) &&
    input.turn.semanticPlan.selectedTargetId === input.currentQuestionTarget &&
    input.turn.semanticPlan.cognitiveAction === "anchor_specific";
  const questionLimitReached = (isDeep
    ? input.microgoalQuestionCount >= 3
    : input.guidedQuestionOpportunityCount >= 3) && !isQuestionLimitRepair;

  if (
    input.turn.semanticPlan.action !== "ask" ||
    (!boundaryDetected && !questionLimitReached)
  ) {
    return input.turn;
  }

  const boundaryReason = boundaryDetected
    ? "用户明确要求停止或拒绝继续"
    : "当前方向已经达到三次提问上限";
  const summaryAnchor = resolveSystemRealizationAnchor({
    rawText: input.rawText,
    facts: [],
    boundaryDetected
  });
  return eventCenteredGenerativeTurnSchema.parse({
    understanding: {
      ...input.turn.understanding,
      eventBoundary: boundaryDetected
        ? "current_event"
        : input.turn.understanding.eventBoundary,
      answerStatus: boundaryDetected ? "declined" : input.turn.understanding.answerStatus,
      factDeltas: input.turn.understanding.factDeltas.filter((fact) =>
        input.rawText.includes(fact.quote)
      ),
      correctionOrBoundary: boundaryDetected
        ? { kind: "boundary", reason: boundaryReason }
        : input.turn.understanding.correctionOrBoundary,
      tentativeInterpretation: null,
      eventOptions: boundaryDetected ? [] : input.turn.understanding.eventOptions
    },
    semanticPlan: {
      action: "honest_limit",
      activeAngle: input.activeAngle,
      outcomeAssessment: {
        state: "limited",
        origin: null,
        basis: boundaryReason,
        supportEvidenceRefs: [],
        missingUnderstanding: null
      },
      evidenceRefs: [],
      insightKind: "scope_only",
      selectedTargetId: null,
      expectedUnderstandingDelta: null,
      tentativeInterpretation: null,
      stopReason: boundaryReason,
      cognitiveAction: null,
      microgoalDelta: null,
      realizationContract: {
        responseCore: boundaryDetected ? "先停在这里" : "停在当前范围",
        summaryAnchors: [summaryAnchor]
      }
    },
    visibleTurn: {
      thinkingSummary: null,
      responseKind: "honest_limit",
      question: null,
      insight: null,
      honestLimit: boundaryDetected ? "好，我们先停在这里。" : "这一段先停在当前范围。"
    }
  });
}

function latestTraceableFactSourceQuote(fact: JournalEventFactRecord) {
  return [...(fact.evidence ?? [])]
    .reverse()
    .find((evidence) => Boolean(evidence.quote?.trim()))
    ?.quote?.trim() ?? null;
}

function buildSemanticPlanMessages(input: EventCenteredGenerativeGenerationInput) {
  const mode = getEventCenteredGenerativeMode(input.phase);
  const thoughtPilot = isEventCenteredThoughtOnlyScope();
  const card = input.activeAngle
    ? EVENT_CENTERED_ANGLE_STRATEGY_CARDS[input.activeAngle]
    : null;
  const examples = input.activeAngle && mode
    ? selectEventCenteredFewShots({ angle: input.activeAngle, mode })
    : [];
  const semanticExamples = buildV4SemanticFewShotReferences(examples);
  const retryIssues = retryableGenerativeValidationIssues(input.retryIssues ?? []);
  const targetedRepairInstructions = semanticPlanRepairInstructions(retryIssues);
  const payload = {
    strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    phase: input.phase,
    mode,
    activeAngle: input.activeAngle,
    angleStrategy: card ? {
      angle: card.angle,
      validEvidence: card.validEvidence,
      directions: mode === "deep" ? card.deepDirections : card.guidedDirections,
      followableClues: card.followableClues,
      excludedDirections: card.excludedDirections
    } : null,
    examples: semanticExamples,
    currentQuestion: input.currentQuestion ? {
      text: input.currentQuestion,
      targetId: input.currentQuestionTarget,
      intent: resolveGenerationCurrentQuestionIntent(input),
      surfaceLevel: input.currentQuestionSurfaceLevel ?? null
    } : null,
    userControl: {
      correctionRequested: Boolean(input.correctionRequested)
    },
    closedDirections: {
      answeredTargetIds: input.answeredTargets,
      deniedTargetIds: input.deniedTargets
    },
    questionBudget: {
      guidedUsed: input.guidedQuestionOpportunityCount,
      currentMicrogoal: input.microgoal,
      deepQuestionAnswerCount: input.microgoal?.answerCount ?? 0
    },
    priorAngleOutcome: input.priorAngleOutcome,
    recentTurns: input.recentTurns.slice(-3),
    effectiveFacts: input.facts.map((fact) => {
      const sourceQuote = latestTraceableFactSourceQuote(fact);
      return {
        id: fact.id,
        statement: fact.statement,
        scope: fact.scope,
        stance: fact.stance,
        kind: fact.kind,
        sourceQuote,
        referenceEligible: Boolean(sourceQuote)
      };
    }),
    rawText: input.rawText,
    responseContract: {
      understanding: {
        eventBoundary: "current_event|background|another_event|multiple_events|unclear",
        coreEventIdentifiable: "boolean",
        answerStatus: "answered|partly_answered|unknown|declined|correction|unrelated",
        factDeltas: "[{statement,scope,stance,kind,quote}]，quote 逐字来自 rawText",
        correctionOrBoundary: "null|{kind:correction|boundary,reason}",
        eventOptions: "multiple_events 时最多两项，其他情况 []"
      },
      decision: {
        state: "needs_more|ready|limited",
        origin: "ready 时填 user_articulated 或 ai_synthesized；其他状态固定 null",
        progressAssessment: "深聊按 user_new_understanding|ai_new_relation|correction_update|no_increment；其他阶段填 not_applicable"
      },
      semanticFrame: "null|{units:[{id,role,evidenceRefs}],relation:null|{type,fromUnitId,toUnitId}}",
      questionIntent: "null|{gap,answerSource:{kind,evidenceRefs,anchorQuote}}",
      limitReason: "null|{kind:insufficient_evidence|no_safe_question|user_boundary,evidenceRefs}"
    }
  };
  const semanticSystemContent = [
    "你只负责本轮语义判断。输出 JSON，最外层直接且仅含 understanding、decision、semanticFrame、questionIntent、limitReason。",
    "event_recording 阶段只抽取事件事实与个人反应，activeAngle 固定为空；不要建立角度成果或成果关系。系统会按事件事实与个人反应的唯一门槛决定是否进入第一检查点。",
    "answerStatus 只描述上一问的回答状态；decision 独立判断本轮是否已有成果。decision.origin 保存成果归属：ready 时，用户原话已经说出成果关系填 user_articulated；AI 根据两侧证据新增安全关系填 ai_synthesized；needs_more 和 limited 固定填 null。深聊同时填写 progressAssessment：用户形成新的区分、关系或校准填 user_new_understanding；AI 基于至少两条证据形成安全的新关系填 ai_new_relation；纠正实质改变旧成果填 correction_update；只新增事实、复述或同义改写填 no_increment；引导复盘填 not_applicable。factDeltas.quote 必须逐字来自 rawText；本轮事实引用 new:N。effectiveFacts 中只有 referenceEligible=true 的已有事实可以用 id 进入 semanticFrame、questionIntent 或 limitReason 的 evidenceRefs；referenceEligible=false 的事实只作理解上下文。",
    "深聊以 priorAngleOutcome 为进入深聊前基线。deepQuestionAnswerCount=0 时，当前表达只用于建立微目标并生成第一个深聊问题，禁止 ready。至少完成一轮有效问答后，才能依据相对基线的实质增量进入 ready；原句复述、同义改写、重复已有成果和单纯新增事实都维持 no_increment。最多完成三轮问答。",
    "纯会话控制边界不是事件事实。rawText 只有停下、不想答、不再继续或结束当前角度等控制表达时，factDeltas=[]，只写入 correctionOrBoundary={kind:boundary,reason}；禁止把同一句控制表达重复写成 event_detail、inner_experience、stated_interpretation、stated_preference 或 boundary_answer。",
    "rawText 同时包含事件内容与控制边界时，correctionOrBoundary 记录控制意图；factDeltas 只抽取逐字可追溯的事件、体验、理解或偏好部分，quote 只截取对应内容片段，不包含停下、不想答、聊到这里等控制分句。boundary_answer 只承载用户对事件内容本身说出的边界或偏好，不承载会话控制。",
    "按固定顺序只选一个结果：处理边界与纠正；形成当前可确认理解；达到阶段成果时 ready；仍有一个只能由用户补齐且会改变理解的具体入口时 needs_more；其余 limited。userControl.correctionRequested=true 时必须使用 answerStatus=correction 且记录 correctionOrBoundary.kind=correction。",
    "semanticFrame 只记录语义骨架，禁止写 statement、解释句、问题句或任何用户可见文案。每个 unit 只能含 id、role、evidenceRefs；id 依次使用 u1、u2、u3，role 只能为 event、change、result、experience、judgment、reason、meaning、scope。",
    "semanticFrame 最多三个 unit。一个 unit 时 relation=null；两个或三个 unit 时必须且只能声明一条 relation。relation 只能为 sequence、contrast、condition、change_effect、coexistence、user_stated_reason，端点必须存在且不同。change_effect 只能从 change 指向 result。",
    "examples 里的 existing:1、new:N 只用于说明示例形状，绝不能直接复制到当前输出。当前输出的 evidenceRefs 只能使用 effectiveFacts 中实际出现的 id，或本轮 factDeltas 按顺序生成的 new:1、new:2、new:3；找不到可引用的当前来源时收为 limited，不能沿用示例编号。",
    "每个 unit 的 evidenceRefs 必须覆盖该单元全部内容。新增关系时，两个关系端点都要有可追溯证据；user_stated_reason 仅用于用户明确说出的原因，时间先后只能使用 sequence。",
    "禁止新增用户未说的感受、原因、关系意义或行动动机，禁止人格、创伤、长期模式和他人动机。时间先后不写成因果。",
    "ready 必须有 semanticFrame 和 decision.origin，questionIntent 和 limitReason 为 null。user_articulated 表示关系可在用户原话中直接找到；ai_synthesized 表示模型根据至少两条相关证据新连接一条安全关系。semanticFrame 要保留最终表达所需的全部 unit 与关系。深聊 ready 还必须具有至少一轮有效问答和相对 priorAngleOutcome 的实质增量。",
    "ai_synthesized 必须有 relation，关系两端合计至少引用两条不同证据。user_articulated 可以使用一个或多个 unit；unit 数量和 relation 结构不能反向决定成果归属。",
    "needs_more 必须同时有 semanticFrame 和 questionIntent，limitReason 为 null。questionIntent.gap 只写 4 到 120 字的内部认识缺口短语，禁止问号、完整问题和第二人称动作叙述。",
    "needs_more 的 answerSource 只指定一个低抽象作答来源：sensory_detail、observable_action、exact_words、mental_image、change_moment 或 direct_comparison。anchorQuote 必须是被 evidenceRefs 指向的原始证据中的逐字片段；引用已有事实时只能从 sourceQuote 逐字截取。禁止生成问题、回答提示或候选答案。",
    "只有存在安全、具体且能改变理解的 answerSource 时才选择 needs_more。找不到入口时：已有可确认理解则 ready，材料不足则 limited。",
    "limited 的 questionIntent 为 null，limitReason 必填；kind 只能为 insufficient_evidence、no_safe_question 或 user_boundary，semanticFrame 可以为 null。limitReason 只保存枚举原因和证据引用，禁止写收束文案。",
    "currentQuestion.intent.minimumAnswerScope 只用于判断上一问是否已回答。已满足范围时不继续追问。用户说不清但仍愿意继续时，保留同一 gap，answerSource 改用更具体的事件入口；找不到这种入口时直接 ready 或 limited。",
    "multiple_events 时 factDeltas=[] 并给出两个 eventOptions。纠正时撤回旧理解，按新答案重新判断。已拒绝方向关闭，问题和预期答案都重复时停止追问。",
    ...(thoughtPilot ? [
      "【GI-065 单角度】activeAngle 固定为 thought。最低阶段成果必须同时覆盖当前判断与一项具体判断依据；后续可探索判断标准、默认假设、证据张力、取舍条件或判断校准。禁止生成感受、关系或行动角度目标。",
      "【GI-065 统一问停】只有当前目标尚未完整回答、缺口只能由用户提供、一个具体低负担答案会实质改变理解三项同时成立时才能 needs_more。每个微目标最多三个问题，整场会话允许在阶段成果后建立新微目标。",
      "【GI-065 覆盖检查】questionIntent 期待获得的答案已经出现在 effectiveFacts、rawText、recentTurns、closedDirections.answeredTargetIds 或 priorAngleOutcome 时，必须重新选一个未覆盖目标。无法找到新目标时选择 ready 或 limited，严禁重复原问题、同义改问或要求用户再次说明已有依据。",
      "【GI-065 开放转场】当前没有 active 微目标且用户继续输入时，先建立一个新微目标。用户只表达继续时，从判断标准、默认假设、证据张力、取舍条件、判断校准中选择证据支持且价值最高的未覆盖缺口并提出首问；若不存在合格缺口则维持开放转场。新微目标的首条表达不能直接 ready。",
      "【GI-065 纠正】correctionRequested=true 时先按新信息更新理解并撤销受影响成果，再重新执行统一问停。只要用户没有同时明确停止，本轮必须选择 needs_more 并提出一个基于新事实的有效问题；纠正本身禁止触发 ready、limited 或结束。"
    ] : []),
    "禁止输出 understandingCard、statement、goal、answerEntry、用户文案、候选列表、打分、action、activeAngle、认识分类、目标编号、认知动作、responseCore、microgoalDelta 或包装层。",
    ...targetedRepairInstructions,
    ...(retryIssues.length > 0
      ? [`定向修复：上一版语义结构未通过以下校验：${retryIssues.join("、")}。只修复这些结构或表达问题；继续使用同一批证据、边界和角度。`]
      : [])
  ].filter(Boolean).join("\n");
  return {
    messages: [
      {
        role: "system" as const,
        content: [
          semanticSystemContent,
          "本阶段最外层直接且仅输出 understanding、decision、semanticFrame、questionIntent 和 limitReason。"
        ].join("\n")
      },
      {
        role: "user" as const,
        content: JSON.stringify(payload)
      }
    ],
    examples: semanticExamples
  };
}

function buildVisibleTurnMessages(input: EventCenteredGenerativeGenerationInput & {
  artifact: EventCenteredGenerativeSemanticPlanArtifact;
}) {
  const thoughtPilot = isEventCenteredThoughtOnlyScope();
  const retryIssues = retryableGenerativeValidationIssues(input.retryIssues ?? []);
  const targetedRepairInstructions = visibleTurnRepairInstructions(retryIssues);
  return [
    {
      role: "system" as const,
      content: [
        "你只负责把冻结的语义骨架写成自然、克制的中文，并且只输出一个 JSON 对象。最外层只输出 thinkingSummary、response、cannotExpressReason，不能输出其他 JSON 字段。能够忠实表达时 response 填最终回应、cannotExpressReason=null；无法忠实表达时 response=null、thinkingSummary=null，并填写 cannotExpressReason。不要输出 status、question、insight、honestLimit、visibleTurn 或其他包装层。",
        ...targetedRepairInstructions,
        "你只能读取 origin、semanticFrame、questionIntent、limitReason 和 sourceEvidence。五项全部只读；禁止改变成果归属、单元、角色、关系、缺口、作答来源或限制原因。",
        "sourceEvidence 只包含骨架实际引用的原话与事实。所有可见内容只能来自这些证据，禁止利用完整对话、推测或内部兼容文案重新解释用户。",
        ...(input.correctionRequested
          ? ["correctionContext 只用于知道前一轮理解需要被替换：旧理解只能用于自然承认一次纠正，禁止复述旧说法；新理解只以冻结的 semanticFrame 和 sourceEvidence 为准。"]
          : []),
        "questionIntent 非空时写 thinkingSummary，并把一个问题写入 response；limitReason 非空时 thinkingSummary 固定为 null，把诚实收束写入 response；其余情况 thinkingSummary 固定为 null，把成果回应写入 response。用户可见类型由系统根据冻结动作映射。",
        "所有可见字段都是 AI 面向用户的对话回应。统一使用第二人称‘你/你的’或省略主语，保持 AI 的说话身份。",
        "第一人称‘我/我的/我们/我们的’只允许出现在带引号的用户原话中。禁止把骨架改写成用户日记、自述或独白，禁止让 AI 冒用用户口吻。",
        "questionIntent 非空时，thinkingSummary 用一至两句、最多160字说明：AI 此刻怎样理解用户问题、当前关键矛盾/关系/认识缺口，以及下一问聚焦该方向的原因。response 只写一个围绕 gap 的问题，并严格从 answerSource.kind 指定的来源发问；anchorQuote 只帮助定位，问题优先用‘当时、那次、说完后、看到时’等自然指代，禁止用‘你提到……’复述原句。",
        "thinkingSummary 与问题严格分工。thinkingSummary 禁止引用或同义复述用户原话、罗列事实、改写问题、预告答案、第一人称动作、候选列表、内部流程、回答提示、未经确认的动机和结果。question 只负责提供一个具体作答入口。",
        ...(thoughtPilot ? [
          "GI-065 的正式问题只服务于理清判断。问题期待的答案若已存在于 sourceEvidence 或已冻结语义骨架中，必须填写 cannotExpressReason=QUESTION_EXPECTED_ANSWER_ALREADY_PRESENT，禁止换一种说法再次追问。",
          "GI-065 在 questionIntent 为空且 limitReason 为空时，response 写一至两句对当前判断关系、矛盾或校准的理解，说明这项认识如何成立；禁止复述事件经过、用户原句或把两条事实逐项重说。界面会把这段内容放入浅色思路层，并另行显示固定开放转场文案。"
        ] : []),
        ...(!thoughtPilot ? [
          "questionIntent 为空且 limitReason 为空时，origin=user_articulated 的 response 只供内部成果校验，忠实覆盖 semanticFrame；界面会直接进入检查点。origin=ai_synthesized 时 response 只展示骨架冻结的新增关系一次，用最少必要指代连接两侧证据，禁止先复述两侧原句再总结关系，也不能把 sequence、coexistence 等关系改写成因果。"
        ] : []),
        "关系表达严格保持 semanticFrame.relation 的原有语义：sequence 只写先后，contrast 只写并存的差异，condition 只写条件，change_effect 只写已冻结的动作与结果，coexistence 只写并存，user_stated_reason 只写用户已经说出的原因。sourceEvidence 未明确出现的因果、目的、价值、需要或重要性都不能加入可见回应。",
        "limitReason 非空时，response 只表达 semanticFrame 可确认的范围与 kind 对应的诚实收口；semanticFrame 为 null 时只说明目前材料不足、缺少安全问题或尊重用户边界。",
        "表达层要把语义计划翻译成用户会自然说出的日常中文，禁止照抄内部模板、占位符和‘事情层、关系层、结果层、过程层、事实层、意义层、存在张力’等分析标签。",
        "禁止诊断、说教、推断他人动机、主动给建议或暴露内部字段。",
        ...(input.correctionRequested
          ? ["本轮承接的是用户纠正；thinkingSummary 要自然承认此前理解需要调整，response 继续沿用冻结后的新理解。"]
          : []),
        ...(retryIssues.length
          ? ["完成前静默自检：保留冻结骨架、来源和正式问题；思路层与正式问题分工清楚。"]
          : [])
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        origin: input.artifact.decisionOrigin,
        correctionRequested: Boolean(input.correctionRequested) ||
          input.artifact.understanding.correctionOrBoundary?.kind === "correction",
        ...(input.correctionRequested
          ? {
              correctionContext: {
                previousUnderstanding: input.facts.map((fact) => ({
                  statement: fact.statement,
                  sourceQuote: latestTraceableFactSourceQuote(fact)
                })),
                updatedUnderstanding: input.artifact.understanding.factDeltas.map((fact) => ({
                  statement: fact.statement,
                  sourceQuote: fact.quote
                }))
              }
            }
          : {}),
        semanticFrame: input.artifact.semanticFrame,
        questionIntent: input.artifact.providerQuestionIntent,
        limitReason: input.artifact.providerLimitReason,
        sourceEvidence: input.artifact.evidenceStatements.map(({ ref, sourceText }) => ({
          ref,
          sourceText
        }))
      })
    }
  ];
}

function buildGenerativeValidationContext(input: EventCenteredGenerativeGenerationInput) {
  const boundaryDetected = isGenerativeTextBoundaryExpression(input);
  return {
    rawText: input.rawText,
    phase: input.phase,
    angle: input.activeAngle,
    existingFactIds: input.facts.map((fact) => fact.id),
    existingFactStatements: input.facts.map((fact) => fact.statement),
    recentUserTexts: input.recentTurns.map((turn) => turn.user),
    currentQuestionText: input.currentQuestion,
    recentQuestionTexts: input.recentTurns
      .map((turn) => turn.assistantQuestion)
      .filter((question): question is string => Boolean(question))
      .slice(-3),
    currentQuestionTarget: input.currentQuestionTarget,
    currentQuestionCognitiveAction: input.currentQuestionCognitiveAction,
    askedTargets: input.askedTargets,
    answeredTargets: input.answeredTargets,
    deniedTargets: input.deniedTargets,
    guidedQuestionOpportunityCount: input.guidedQuestionOpportunityCount,
    microgoalQuestionCount: input.microgoal?.questionCount ?? 0,
    deepQuestionAnswerCount: input.microgoal?.answerCount,
    priorAngleOutcomeStatement: input.priorAngleOutcome?.statement ?? null,
    allowQuestionLimitRepair: hasAvailableGenerativeUnableAnswerRepair(input),
    boundaryDetected,
    correctionDetected: Boolean(input.correctionRequested) ||
      isExplicitEventCenteredCorrection(input.rawText),
    multipleEventsDetected: !boundaryDetected &&
      splitEventCenteredSourceGroups(input.rawText).length === 2,
    latestEmphasis: null,
    requireOutcomeAssessment: true
  };
}

function validateGeneratedSemanticPlan(
  input: EventCenteredGenerativeGenerationInput,
  plan: {
    understanding: EventCenteredGenerativeTurn["understanding"];
    semanticPlan: EventCenteredGenerativeTurn["semanticPlan"];
  },
  limitReasonKind: EventCenteredSemanticLimitReason["kind"] | null = null
) {
  const context = buildGenerativeValidationContext(input);
  return validateEventCenteredGenerativeSemanticPlan({
    understanding: plan.understanding,
    semanticPlan: plan.semanticPlan,
    rawText: input.rawText,
    limitReasonKind,
    phase: context.phase,
    angle: context.angle,
    existingFactIds: context.existingFactIds,
    existingFactStatements: context.existingFactStatements,
    currentQuestionTarget: context.currentQuestionTarget,
    currentQuestionCognitiveAction: context.currentQuestionCognitiveAction,
    askedTargets: context.askedTargets,
    answeredTargets: context.answeredTargets,
    deniedTargets: context.deniedTargets,
    guidedQuestionOpportunityCount: context.guidedQuestionOpportunityCount,
    microgoalQuestionCount: context.microgoalQuestionCount,
    deepQuestionAnswerCount: context.deepQuestionAnswerCount,
    priorAngleOutcomeStatement: context.priorAngleOutcomeStatement,
    allowQuestionLimitRepair: context.allowQuestionLimitRepair,
    boundaryDetected: context.boundaryDetected,
    correctionDetected: context.correctionDetected,
    requireOutcomeAssessment: context.requireOutcomeAssessment
  });
}

function validateGeneratedTurn(
  input: EventCenteredGenerativeGenerationInput,
  turn: EventCenteredGenerativeTurn
) {
  return validateEventCenteredGenerativeTurn({
    turn,
    ...buildGenerativeValidationContext(input)
  });
}

function failedGenerativeResult(input: {
  provider: AIProvider | null;
  attempts: StructuredOutputAttempt[];
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
  validationIssues: string[];
  qualityDiagnostics?: string[];
  fewShotIds: string[];
  architecture: EventCenteredGenerativeArchitecture;
  strategyVersion?: string;
}): EventCenteredGenerativeGenerationResult {
  return {
    turn: null,
    semanticArtifact: null,
    outputOrigin: input.provider ? "fallback" : "deterministic",
    attempts: input.attempts,
    promptLineage: input.promptLineage,
    validationIssues: input.validationIssues,
    qualityDiagnostics: input.qualityDiagnostics ?? [],
    strategyVersion: input.strategyVersion ?? EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    fewShotIds: input.fewShotIds,
    architecture: input.architecture
  };
}

function attemptIssues(attempts: StructuredOutputAttempt[]) {
  const lastAttempt = attempts.at(-1);
  return [
    lastAttempt?.errorCode ?? "MODEL_OUTPUT_UNAVAILABLE",
    ...(lastAttempt?.errorMessage ? [lastAttempt.errorMessage] : [])
  ];
}

/**
 * 重试提示只允许携带本地校验码。上游返回内容、用户原话和模型原始输出
 * 都留在 Trace，不能被拼回下一次模型请求。
 */
function retryableGenerativeValidationIssues(issues: readonly string[]) {
  const transientCodes = new Set([
    "PROVIDER_NOT_CONFIGURED",
    "SERVICE_UNAVAILABLE_ERROR",
    "TIMEOUT",
    "REQUEST_FAILED",
    "UPSTREAM_HTTP_ERROR"
  ]);
  return [...new Set(issues.flatMap((issue) => {
    const normalized = issue.trim();
    if (!normalized || transientCodes.has(normalized)) return [];
    const safeCode = normalized.match(/^[A-Za-z0-9_.:-]{3,180}/u)?.[0] ?? null;
    return safeCode ? [safeCode] : [];
  }))].slice(0, 6);
}

/**
 * 语义阶段的校验码只描述结构，模型需要知道怎样在不补写事实的前提下返工。
 * 这层提示只覆盖已经确认的关系字段形状问题；来源、纠正和停止风险仍走硬降级。
 */
function semanticPlanRepairInstructions(retryIssues: readonly string[]) {
  if (retryIssues.length === 0) return [];
  const instructions = [
    "本轮是一次定向返工。上一版语义 JSON 被结构校验拒绝；请重新输出完整 JSON，并保持同一批来源证据、边界和角度。"
  ];
  const hasRelationShapeIssue = retryIssues.some((issue) =>
    issue.includes("semanticFrame.relation") || issue.includes("change_effect")
  );
  if (hasRelationShapeIssue) {
    instructions.push(
      "上一版的关系结构不合法：change_effect 只在用户明确表达“一个变化带来一个结果”时使用，fromUnitId 必须指向 role=change，toUnitId 必须指向 role=result，两个端点都要有来源证据。若现有证据只说明事件、体验或先后，改用有来源支持的 sequence、coexistence 或 user_stated_reason；若安全关系无法成立，收为一个语义单元并把 relation 设为 null。不得为了凑关系改写角色、补造结果或新增因果。"
    );
  }
  if (retryIssues.includes("INVALID_SCHEMA")) {
    instructions.push(
      "逐项核对最外层五个字段和 semanticFrame：unit id 依次为 u1/u2/u3；一个 unit 时 relation=null；两个或三个 unit 时只保留一条端点存在且不同的合法 relation。"
    );
  }
  return instructions;
}

/**
 * 模型看不懂内部校验码时会原样重复同一种句式。把已确认的表达问题翻译为
 * 可执行的中文返工要求，仍只允许它在冻结的骨架内改写。
 */
function visibleTurnRepairInstructions(retryIssues: readonly string[]) {
  if (retryIssues.length === 0) return [];
  const instructions = [
    "本轮是一次定向返工。上一版已被系统拒绝；请重新输出完整 JSON，并优先满足下面的返工要求。"
  ];
  if (retryIssues.includes("thinking_summary_repeats_user_expression")) {
    instructions.push(
      "思路层曾复述用户表达：当 questionIntent 非空时，thinkingSummary 只说明当前要分清的关系或认识缺口，以及下一问为何有价值。它不能以“你提到/你说”开头，不能重说 sourceEvidence 里的事件、人物、动作、感受、判断或愿望，也不能把正式问题换一种说法再写一遍。可使用抽象关系词和自然指代。"
    );
  }
  if (retryIssues.includes("visible_turn_uses_unquoted_user_first_person")) {
    instructions.push(
      "上一版出现了冒用用户口吻的第一人称：本次所有可见字段都不得出现“我、我的、我们、我们的”，也不得把用户原话放进引号。统一使用“你/你的”、自然省略主语或“这件事/当前线索”。"
    );
  }
  const knownIssues = new Set([
    "thinking_summary_repeats_user_expression",
    "visible_turn_uses_unquoted_user_first_person"
  ]);
  const otherIssues = retryIssues.filter((issue) => !knownIssues.has(issue));
  if (otherIssues.length > 0) {
    instructions.push(
      `其余校验问题（${otherIssues.join("、")}）要求你完整遵守冻结骨架、来源边界和字段形状；不要增添任何新事实、关系或建议。`
    );
  }
  return instructions;
}

const LOCAL_DETERMINISTIC_THINKING_SUMMARY_REPAIR_ISSUES = new Set([
  "ask_requires_thinking_summary",
  "thinking_summary_repeats_user_expression",
  "thinking_summary_must_not_repeat_main_response",
  "thinking_summary_must_not_repeat_question_target",
  "thinking_summary_direction_mismatch",
  "visible_turn_uses_unquoted_user_first_person"
]);

function hasUnquotedFirstPersonExpression(value: string | null | undefined) {
  const withoutQuotedText = (value ?? "")
    .replace(/“[^”]*”/gu, "")
    .replace(/"[^"]*"/gu, "")
    .replace(/‘[^’]*’/gu, "")
    .replace(/'[^']*'/gu, "");
  return /(?:^|[，。！？；：\s])我(?:的|当时|现在|觉得|感觉|希望|想|认为|判断|担心|害怕|需要|很|有点|不想|更)/u.test(
    withoutQuotedText
  );
}

function systemThinkingSummaryForQuestion(
  questionIntent: EventCenteredSemanticQuestionIntent
) {
  const summaryBySource: Record<
    EventCenteredSemanticQuestionIntent["answerSource"]["kind"],
    string
  > = {
    sensory_detail: "当前需要先把这件事落到一个可感知的细节上，这样下一问才有明确落点。",
    observable_action: "当前需要先看清事情前后的实际动作，这样下一问才有明确落点。",
    exact_words: "当前需要先分清互动里真正起作用的说法，这样下一问才有明确落点。",
    mental_image: "当前需要先回到当时最清楚的画面，这样下一问才有明确落点。",
    change_moment: "当前需要先找出感受开始变化的时点，这样下一问才有明确落点。",
    direct_comparison: "当前需要先分开看判断里的两边依据，这样下一问才有明确落点。"
  };
  return summaryBySource[questionIntent.answerSource.kind];
}

/**
 * ask 的思路层属于固定体验契约。模型已经产出合格正式问题、仅思路层触发
 * 复述或用户口吻时，服务端按冻结问题来源补齐一条中性说明，避免丢掉整轮
 * 生成式能力，也避免把同一份不合格表达再次展示给用户。
 */
function repairThinkingSummaryDeterministically(input: {
  turn: EventCenteredGenerativeTurn;
  questionIntent: EventCenteredSemanticQuestionIntent | null;
  validationIssues: readonly string[];
}) {
  if (input.turn.semanticPlan.action !== "ask" || !input.questionIntent) return null;
  const hardIssues = partitionEventCenteredGenerativeValidationIssues(
    input.validationIssues
  ).hardIssues;
  if (
    hardIssues.length === 0 ||
    hardIssues.some((issue) => !LOCAL_DETERMINISTIC_THINKING_SUMMARY_REPAIR_ISSUES.has(issue))
  ) {
    return null;
  }
  const hasFirstPersonOutsideSummary = [
    input.turn.visibleTurn.question,
    input.turn.visibleTurn.insight,
    input.turn.visibleTurn.honestLimit
  ].some((value) => hasUnquotedFirstPersonExpression(value));
  if (hasFirstPersonOutsideSummary) return null;

  const thinkingSummary = systemThinkingSummaryForQuestion(input.questionIntent);
  return {
    turn: {
      ...input.turn,
      visibleTurn: {
        ...input.turn.visibleTurn,
        thinkingSummary
      },
      reply: {
        ...input.turn.reply,
        naturalUnderstanding: thinkingSummary
      }
    },
    diagnostic: `local_deterministic_thinking_summary_repair:${hardIssues.join(",")}`
  };
}

function needsTransientGenerativeRetry(issues: readonly string[]) {
  return issues.some((issue) => /(?:SERVICE_UNAVAILABLE|TIMEOUT|REQUEST_FAILED|UPSTREAM_HTTP_ERROR)/u.test(issue));
}

async function waitForTransientGenerativeRetry(input: {
  issues: readonly string[];
  signal?: AbortSignal;
}) {
  if (!needsTransientGenerativeRetry(input.issues)) return;
  input.signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      input.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(input.signal?.reason ?? new Error("GENERATION_ABORTED"));
    };
    if (input.signal?.aborted) {
      onAbort();
      return;
    }
    input.signal?.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, 350);
  });
}

function uniqueGenerativePromptLineage(
  ...groups: EventCenteredAIGenerationResult["promptLineage"][]
) {
  const seen = new Set<string>();
  return groups.flat().filter((item) => {
    const key = `${item.promptKey}:${item.promptVersion}:${item.resolvedPromptHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generationExceptionIssue(stage: "PLAN_REQUEST" | "VISIBLE_REQUEST" | "ASSEMBLY", error: unknown) {
  const errorName = error instanceof Error && error.name ? error.name : "UNKNOWN_ERROR";
  return `${stage}_FAILED:${errorName}`;
}

function canonicalVisibleResponseKind(
  action: EventCenteredGenerativeTurn["semanticPlan"]["action"]
): EventCenteredGenerativeTurn["visibleTurn"]["responseKind"] {
  if (action === "ask") return "question";
  if (action === "complete") return "completion";
  if (action === "pause") return "pause";
  return "honest_limit";
}

function deriveTwoStageAction(input: {
  state: EventCenteredTwoStageV4ProviderPlan["decision"]["state"];
  phase: EventCenteredDialoguePhase;
}): EventCenteredGenerativeTurn["semanticPlan"]["action"] | null {
  if (input.state === "needs_more") return "ask";
  if (input.state === "limited") return "honest_limit";
  const mode = getEventCenteredGenerativeMode(input.phase);
  if (mode === "guided") return "complete";
  if (mode === "deep") return "pause";
  return null;
}

function semanticSkeletonEvidenceRefs(input: {
  semanticFrame: EventCenteredSemanticFrame | null;
  questionIntent: EventCenteredSemanticQuestionIntent | null;
  limitReason: EventCenteredSemanticLimitReason | null;
}) {
  return [...new Set([
    ...(input.semanticFrame?.units.flatMap((unit) => unit.evidenceRefs) ?? []),
    ...(input.questionIntent?.answerSource.evidenceRefs ?? []),
    ...(input.limitReason?.evidenceRefs ?? [])
  ])];
}

type FrozenEvidenceStatement =
  EventCenteredGenerativeSemanticPlanArtifact["evidenceStatements"][number];

function buildSemanticEvidenceByRef(input: {
  generationInput: EventCenteredGenerativeGenerationInput;
  understanding: EventCenteredGenerativeTurn["understanding"];
}) {
  return new Map<string, Omit<FrozenEvidenceStatement, "ref">>([
    ...input.generationInput.facts.flatMap((fact) => {
      const sourceQuote = latestTraceableFactSourceQuote(fact);
      return sourceQuote
        ? [[fact.id, {
            statement: fact.statement,
            sourceText: sourceQuote
          }] as const]
        : [];
    }),
    ...input.understanding.factDeltas.map((fact, index) => [
      `new:${index + 1}`,
      { statement: fact.statement, sourceText: fact.quote }
    ] as const)
  ]);
}

type SemanticRelationType = NonNullable<EventCenteredSemanticFrame["relation"]>["type"];

const EXPLICIT_USER_RELATION_PATTERN: Record<SemanticRelationType, RegExp> = {
  sequence: /(?:先.{0,48}(?:再|后)|随后|之后|之前|直到|才)/u,
  contrast: /(?:但|不过|可是|却|相反|一方面.{0,48}另一方面)/u,
  condition: /(?:只要|只有|如果|除非|每当|取决于)/u,
  change_effect: /(?:因为|所以|导致|使得|让.{0,12}(?:变|更|能|无法|开始|停止)|带来|造成|结果(?:是|为))/u,
  coexistence: /(?:同时|既[\s\S]{0,72}也|又[\s\S]{0,72}又|一边[\s\S]{0,72}一边|一面[\s\S]{0,72}一面)/u,
  user_stated_reason: /(?:因为|由于|之所以|是因为|怕(?:的)?是)/u
};

function hasExplicitUserRelationForFrame(input: {
  frame: EventCenteredSemanticFrame;
  evidenceByRef: Map<string, Omit<FrozenEvidenceStatement, "ref">>;
}) {
  const relation = input.frame.relation;
  if (!relation) return true;
  const relationRefs = input.frame.units
    .filter((unit) => unit.id === relation.fromUnitId || unit.id === relation.toUnitId)
    .flatMap((unit) => unit.evidenceRefs);
  const sourceText = relationRefs
    .map((ref) => input.evidenceByRef.get(ref)?.sourceText ?? "")
    .filter(Boolean)
    .join("\n");
  // 用户已经清楚给出任一关系线索时，关系类别的轻量归一不改变来源归属。
  // 例如“才”可由模型组织成先后或并存，但两侧联系仍然来自用户原话。
  return Object.values(EXPLICIT_USER_RELATION_PATTERN).some((pattern) =>
    pattern.test(sourceText)
  );
}

function correctionSemanticRole(
  fact: EventCenteredTwoStageV4ProviderPlan["understanding"]["factDeltas"][number]
): EventCenteredSemanticFrame["units"][number]["role"] {
  if (fact.kind === "event_detail") return "event";
  if (fact.kind === "inner_experience") return "experience";
  if (fact.kind === "stated_interpretation") return "judgment";
  if (fact.kind === "stated_preference") return "expectation";
  return "scope";
}

/**
 * 纠正内容已经来自当前用户原话时，语义骨架遗漏其引用属于局部编排缺口。
 * 在不改变模型目标、关系或结论的前提下补齐引用，让表达层能够承认并使用新理解。
 */
function ensureCorrectionEvidenceCoverage(input: {
  plan: EventCenteredTwoStageV4ProviderPlan;
  correctionDetected: boolean;
}): EventCenteredTwoStageV4ProviderPlan {
  if (!input.correctionDetected) return input.plan;
  const coveredRefs = new Set(semanticSkeletonEvidenceRefs({
    semanticFrame: input.plan.semanticFrame,
    questionIntent: input.plan.questionIntent,
    limitReason: input.plan.limitReason
  }));
  const missingIndexes = input.plan.understanding.factDeltas
    .map((_, index) => index)
    .filter((index) => !coveredRefs.has(`new:${index + 1}`));
  if (missingIndexes.length === 0) return input.plan;

  const missingRefs = missingIndexes.map((index) => `new:${index + 1}`);
  const frame = input.plan.semanticFrame;
  if (!frame) {
    const firstFact = input.plan.understanding.factDeltas[missingIndexes[0]!];
    if (!firstFact) return input.plan;
    return {
      ...input.plan,
      semanticFrame: {
        units: [{
          id: "u1",
          role: correctionSemanticRole(firstFact),
          evidenceRefs: missingRefs
        }],
        relation: null
      }
    };
  }

  if (frame.units.length === 1) {
    const unit = frame.units[0]!;
    if (unit.evidenceRefs.length + missingRefs.length > 6) return input.plan;
    return {
      ...input.plan,
      semanticFrame: {
        ...frame,
        units: [{
          ...unit,
          evidenceRefs: [...unit.evidenceRefs, ...missingRefs]
        }]
      }
    };
  }

  if (frame.units.length >= 3) return input.plan;
  const nextId = (["u1", "u2", "u3"] as const).find((id) =>
    !frame.units.some((unit) => unit.id === id)
  );
  const firstFact = input.plan.understanding.factDeltas[missingIndexes[0]!];
  if (!nextId || !firstFact) return input.plan;
  return {
    ...input.plan,
    semanticFrame: {
      ...frame,
      units: [...frame.units, {
        id: nextId,
        role: correctionSemanticRole(firstFact),
        evidenceRefs: missingRefs
      }]
    }
  };
}

/**
 * 用户清楚说出两条事实，并不等于已经亲口说出了它们之间的关系。
 * 这类安全连接应归入 ai_synthesized，并继续要求两侧均有来源证据。
 */
function normalizeUserArticulatedRelationOrigin(input: {
  plan: EventCenteredTwoStageV4ProviderPlan;
  generationInput: EventCenteredGenerativeGenerationInput;
}) {
  const frame = input.plan.semanticFrame;
  if (
    input.plan.decision.state !== "ready" ||
    input.plan.decision.origin !== "user_articulated" ||
    !frame?.relation
  ) {
    return input.plan;
  }
  const relationRefs = frame.units
    .filter((unit) =>
      unit.id === frame.relation?.fromUnitId || unit.id === frame.relation?.toUnitId
    )
    .flatMap((unit) => unit.evidenceRefs);
  if (new Set(relationRefs).size < 2) return input.plan;
  const evidenceByRef = buildSemanticEvidenceByRef({
    generationInput: input.generationInput,
    understanding: {
      ...input.plan.understanding,
      tentativeInterpretation: null
    }
  });
  if (hasExplicitUserRelationForFrame({ frame, evidenceByRef })) return input.plan;
  return {
    ...input.plan,
    decision: {
      ...input.plan.decision,
      origin: "ai_synthesized" as const
    }
  };
}

function normalizeDeepProgressAssessment(input: {
  plan: EventCenteredTwoStageV4ProviderPlan;
  generationInput: EventCenteredGenerativeGenerationInput;
}) {
  const mode = getEventCenteredGenerativeMode(input.generationInput.phase);
  const correction = Boolean(input.generationInput.correctionRequested) ||
    isExplicitEventCenteredCorrection(input.generationInput.rawText);
  const progressAssessment = mode !== "deep"
    ? "not_applicable" as const
    : input.plan.decision.state !== "ready"
      ? "no_increment" as const
      : correction
        ? "correction_update" as const
        : input.plan.decision.origin === "ai_synthesized"
          ? "ai_new_relation" as const
          : "user_new_understanding" as const;
  return {
    ...input.plan,
    decision: {
      ...input.plan.decision,
      progressAssessment
    }
  };
}

function hasVerbatimSemanticAnchor(
  anchor: string,
  evidence: Omit<FrozenEvidenceStatement, "ref">
) {
  const normalizedAnchor = normalizeText(anchor);
  return normalizeText(evidence.sourceText).includes(normalizedAnchor);
}

function validateSemanticSkeletonEvidence(input: {
  semanticFrame: EventCenteredSemanticFrame | null;
  questionIntent: EventCenteredSemanticQuestionIntent | null;
  limitReason: EventCenteredSemanticLimitReason | null;
  evidenceByRef: Map<string, Omit<FrozenEvidenceStatement, "ref">>;
}) {
  const issues: string[] = [];
  for (const ref of input.semanticFrame?.units.flatMap((unit) => unit.evidenceRefs) ?? []) {
    if (!input.evidenceByRef.has(ref)) {
      issues.push(`SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE:${ref}`);
    }
  }
  for (const ref of input.questionIntent?.answerSource.evidenceRefs ?? []) {
    if (!input.evidenceByRef.has(ref)) {
      issues.push(`QUESTION_ANSWER_SOURCE_REF_UNTRACEABLE:${ref}`);
    }
  }
  for (const ref of input.limitReason?.evidenceRefs ?? []) {
    if (!input.evidenceByRef.has(ref)) {
      issues.push(`LIMIT_REASON_EVIDENCE_REF_UNTRACEABLE:${ref}`);
    }
  }
  const answerSource = input.questionIntent?.answerSource;
  if (answerSource) {
    const referencedEvidence = answerSource.evidenceRefs.flatMap((ref) => {
      const evidence = input.evidenceByRef.get(ref);
      return evidence ? [evidence] : [];
    });
    if (
      referencedEvidence.length === 0 ||
      !referencedEvidence.some((evidence) =>
        hasVerbatimSemanticAnchor(answerSource.anchorQuote, evidence)
      )
    ) {
      issues.push("QUESTION_ANSWER_SOURCE_ANCHOR_UNTRACEABLE");
    }
  }
  return [...new Set(issues)];
}

const CORRECTION_CONTROL_ONLY_CLAUSE_PATTERN = /^(?:你|刚才|前面).{0,12}(?:理解|说|记|写).{0,4}(?:反了|错了|不对)|^(?:不对|不是这个意思|我纠正一下|先纠正一下)$/u;

function currentTurnContentClauses(rawText: string) {
  return normalizeText(rawText)
    .split(/[，,。！？!?；;\n]+/u)
    .map((clause) => clause.trim())
    .filter((clause) => Array.from(clause.replace(/[\s\p{P}\p{S}]+/gu, "")).length >= 2)
    .filter((clause) =>
      !STOP_PATTERN.test(clause) &&
      !STOP_CLAUSE_PATTERN.test(clause) &&
      !CONTINUE_CLAUSE_PATTERN.test(clause) &&
      !isStandaloneUnknownExpression(clause) &&
      !CORRECTION_CONTROL_ONLY_CLAUSE_PATTERN.test(clause)
    );
}

function normalizeCurrentTurnCoverageText(value: string) {
  return normalizeText(value)
    .replace(/[\s，,。！？!?；;：:'"“”‘’（）()【】\[\]]+/gu, "")
    .replace(/^(?:但|不过|可是|而且|同时|然后|后来)/u, "");
}

/**
 * 第一段可以决定本轮材料暂时不进入主成果，但不能让用户有效表达消失。
 * 普通多分句遗漏只记录质量诊断；纠正内容遗漏继续作为安全硬门。
 */
export function validateCurrentTurnMaterialCoverage(input: {
  rawText: string;
  correctionDetected: boolean;
  plan: EventCenteredTwoStageV4ProviderPlan;
}) {
  if (
    (
      input.plan.understanding.eventBoundary === "multiple_events" ||
      input.plan.understanding.eventBoundary === "another_event"
    ) && !input.correctionDetected
  ) {
    return [];
  }
  const clauses = currentTurnContentClauses(input.rawText);
  const quotes = input.plan.understanding.factDeltas.map((fact) =>
    normalizeCurrentTurnCoverageText(fact.quote)
  );
  const issues = clauses.length < 2 ? [] : clauses.flatMap((clause, index) => {
    const normalizedClause = normalizeCurrentTurnCoverageText(clause);
    return quotes.some((quote) => quote.includes(normalizedClause))
      ? []
      : [`CURRENT_TURN_CONTENT_OMITTED:${index + 1}`];
  });

  if (input.correctionDetected) {
    const frameRefs = new Set(
      semanticSkeletonEvidenceRefs({
        semanticFrame: input.plan.semanticFrame,
        questionIntent: input.plan.questionIntent,
        limitReason: input.plan.limitReason
      })
    );
    input.plan.understanding.factDeltas.forEach((_, index) => {
      const ref = `new:${index + 1}`;
      if (!frameRefs.has(ref)) issues.push(`CORRECTION_SCOPE_OMITTED:${ref}`);
    });
  }
  return [...new Set(issues)];
}

function collectFrozenEvidenceStatements(input: {
  generationInput: EventCenteredGenerativeGenerationInput;
  understanding: EventCenteredGenerativeTurn["understanding"];
  semanticFrame: EventCenteredSemanticFrame | null;
  questionIntent: EventCenteredSemanticQuestionIntent | null;
  limitReason: EventCenteredSemanticLimitReason | null;
}) {
  const evidenceByRef = buildSemanticEvidenceByRef(input);
  return semanticSkeletonEvidenceRefs(input).flatMap((ref) => {
    const evidence = evidenceByRef.get(ref);
    return evidence ? [{ ref, ...evidence }] : [];
  });
}

export function createSemanticPlanArtifactHash(input: {
  understanding: EventCenteredGenerativeTurn["understanding"];
  decisionOrigin: EventCenteredTwoStageV4ProviderPlan["decision"]["origin"];
  semanticFrame: EventCenteredSemanticFrame | null;
  providerQuestionIntent: EventCenteredSemanticQuestionIntent | null;
  providerLimitReason: EventCenteredSemanticLimitReason | null;
  understandingCard: EventCenteredUnderstandingCard | null;
  questionIntent: EventCenteredQuestionIntent | null;
  limitReason: string | null;
  semanticPlan: EventCenteredGenerativeTurn["semanticPlan"];
  evidenceStatements: EventCenteredGenerativeSemanticPlanArtifact["evidenceStatements"];
}) {
  return createPromptEnvelope({
    promptKey: "interview.event_centered.generative_semantic_plan_artifact",
    promptVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
    messages: [{
      role: "user",
      content: JSON.stringify(canonicalizeSemanticArtifactValue(input))
    }]
  }).resolvedPromptHash;
}

export function canonicalizeSemanticArtifactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeSemanticArtifactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeSemanticArtifactValue(item)])
    );
  }
  return value;
}

function failedSemanticPlanStageResult(input: {
  provider: AIProvider | null;
  attempts: StructuredOutputAttempt[];
  promptLineage: EventCenteredAIGenerationResult["promptLineage"];
  validationIssues: string[];
  qualityDiagnostics?: string[];
  fewShotIds: string[];
}): EventCenteredGenerativeSemanticPlanStageResult {
  return {
    artifact: null,
    outputOrigin: input.provider ? "fallback" : "deterministic",
    attempts: input.attempts,
    promptLineage: input.promptLineage,
    validationIssues: input.validationIssues,
    qualityDiagnostics: input.qualityDiagnostics ?? [],
    strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    fewShotIds: input.fewShotIds,
    architecture: "two_call"
  };
}

function buildSemanticPlanEnvelope(input: EventCenteredGenerativeGenerationInput) {
  const built = buildSemanticPlanMessages(input);
  const envelope = createPromptEnvelope({
    promptKey: "interview.event_centered.generative_semantic_plan",
    promptVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
    messages: built.messages
  });
  return { built, envelope };
}

function validateSemanticPlanArtifactBinding(input: {
  generationInput: EventCenteredGenerativeGenerationInput;
  artifact: EventCenteredGenerativeSemanticPlanArtifact;
  expectedPlanPromptHash: string;
  expectedFewShotIds: string[];
}) {
  const issues: string[] = [];
  const artifact = input.artifact;
  if (artifact.artifactVersion !== EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION) {
    issues.push("SEMANTIC_PLAN_ARTIFACT_VERSION_MISMATCH");
  }
  if (artifact.strategyVersion !== EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION) {
    issues.push("SEMANTIC_PLAN_STRATEGY_VERSION_MISMATCH");
  }
  if (artifact.angleCardVersion !== EVENT_CENTERED_ANGLE_CARD_VERSION) {
    issues.push("SEMANTIC_PLAN_ANGLE_CARD_VERSION_MISMATCH");
  }
  if (artifact.fewShotVersion !== EVENT_CENTERED_FEW_SHOT_VERSION) {
    issues.push("SEMANTIC_PLAN_FEW_SHOT_VERSION_MISMATCH");
  }
  if (artifact.promptVersion !== EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION) {
    issues.push("SEMANTIC_PLAN_PROMPT_VERSION_MISMATCH");
  }
  const { tentativeInterpretation: _compatInterpretation, ...providerUnderstanding } =
    artifact.understanding;
  void _compatInterpretation;
  const parsedProviderPlan = eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
    understanding: providerUnderstanding,
    decision: {
      state: artifact.decisionState,
      origin: artifact.decisionOrigin,
      progressAssessment: artifact.decisionProgressAssessment
    },
    semanticFrame: artifact.semanticFrame,
    questionIntent: artifact.providerQuestionIntent,
    limitReason: artifact.providerLimitReason
  });
  if (!parsedProviderPlan.success) {
    issues.push(...parsedProviderPlan.error.issues.map((issue) =>
      `SEMANTIC_PLAN_V4_SCHEMA:${issue.path.join(".")}:${issue.message}`
    ));
  }
  if (!Array.isArray(artifact.evidenceStatements) || artifact.evidenceStatements.some((item) =>
    !item?.ref?.trim() || !item.statement?.trim() || !item.sourceText?.trim()
  )) {
    issues.push("SEMANTIC_PLAN_SOURCE_EVIDENCE_INVALID");
  }
  if (parsedProviderPlan.success && Array.isArray(artifact.evidenceStatements)) {
    const expectedEvidenceRefs = semanticSkeletonEvidenceRefs({
      semanticFrame: parsedProviderPlan.data.semanticFrame,
      questionIntent: parsedProviderPlan.data.questionIntent,
      limitReason: parsedProviderPlan.data.limitReason
    });
    const actualEvidenceRefs = artifact.evidenceStatements.map((item) => item.ref);
    if (JSON.stringify(actualEvidenceRefs) !== JSON.stringify(expectedEvidenceRefs)) {
      issues.push("SEMANTIC_PLAN_SOURCE_EVIDENCE_BINDING_MISMATCH");
    }
    const evidenceByRef = new Map(
      artifact.evidenceStatements.map(({ ref, statement, sourceText }) => [
        ref,
        { statement, sourceText }
      ])
    );
    issues.push(...validateSemanticSkeletonEvidence({
      semanticFrame: parsedProviderPlan.data.semanticFrame,
      questionIntent: parsedProviderPlan.data.questionIntent,
      limitReason: parsedProviderPlan.data.limitReason,
      evidenceByRef
    }));
    try {
      const compatibilityProjection =
        deriveEventCenteredGenerativePlanFromSemanticSkeleton(
          input.generationInput,
          parsedProviderPlan.data
        );
      const normalizedCompatibilityProjection = {
        understanding: compatibilityProjection.understanding,
        semanticPlan: compatibilityProjection.semanticPlan,
        understandingCard: compatibilityProjection.understandingCard,
        questionIntent: compatibilityProjection.questionIntent,
        limitReason: compatibilityProjection.limitReason
      };
      const frozenCompatibilityProjection = {
        understanding: artifact.understanding,
        semanticPlan: artifact.semanticPlan,
        understandingCard: artifact.understandingCard,
        questionIntent: artifact.questionIntent,
        limitReason: artifact.limitReason
      };
      if (JSON.stringify(canonicalizeSemanticArtifactValue(
        normalizedCompatibilityProjection
      )) !== JSON.stringify(canonicalizeSemanticArtifactValue(
        frozenCompatibilityProjection
      ))) {
        issues.push("SEMANTIC_PLAN_COMPATIBILITY_PROJECTION_MISMATCH");
      }
    } catch {
      issues.push("SEMANTIC_PLAN_COMPATIBILITY_PROJECTION_INVALID");
    }
  }
  if (
    artifact.inputBinding.phase !== input.generationInput.phase ||
    artifact.inputBinding.activeAngle !== input.generationInput.activeAngle ||
    artifact.inputBinding.currentQuestionTarget !== input.generationInput.currentQuestionTarget
  ) {
    issues.push("SEMANTIC_PLAN_INPUT_BINDING_MISMATCH");
  }
  if (artifact.inputBinding.planPromptHash !== input.expectedPlanPromptHash) {
    issues.push("SEMANTIC_PLAN_PROMPT_HASH_MISMATCH");
  }
  const expectedSemanticPlanHash = createSemanticPlanArtifactHash({
    understanding: artifact.understanding,
    decisionOrigin: artifact.decisionOrigin,
    semanticFrame: artifact.semanticFrame,
    providerQuestionIntent: artifact.providerQuestionIntent,
    providerLimitReason: artifact.providerLimitReason,
    understandingCard: artifact.understandingCard,
    questionIntent: artifact.questionIntent,
    limitReason: artifact.limitReason,
    semanticPlan: artifact.semanticPlan,
    evidenceStatements: artifact.evidenceStatements
  });
  if (artifact.inputBinding.semanticPlanHash !== expectedSemanticPlanHash) {
    issues.push("SEMANTIC_PLAN_CONTENT_HASH_MISMATCH");
  }
  if (
    artifact.promptLineage.length !== 1 ||
    artifact.promptLineage[0]?.promptKey !==
      "interview.event_centered.generative_semantic_plan" ||
    artifact.promptLineage[0]?.promptVersion !==
      EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION ||
    artifact.promptLineage[0]?.resolvedPromptHash !== input.expectedPlanPromptHash
  ) {
    issues.push("SEMANTIC_PLAN_LINEAGE_MISMATCH");
  }
  if (JSON.stringify(artifact.fewShotIds) !== JSON.stringify(input.expectedFewShotIds)) {
    issues.push("SEMANTIC_PLAN_FEW_SHOT_IDS_MISMATCH");
  }
  return [...new Set(issues)];
}

type SystemManagedSemanticPlanInput = Omit<
  EventCenteredGenerativeTurn["semanticPlan"],
  "microgoalDelta" | "realizationContract"
> & Partial<Pick<
  EventCenteredGenerativeTurn["semanticPlan"],
  "microgoalDelta" | "realizationContract"
>>;

function compatibilityResponseCore(input: {
  action: EventCenteredGenerativeTurn["semanticPlan"]["action"];
  visibleTurn?: EventCenteredProviderGenerativeTurn["visibleTurn"];
  semanticPlan: SystemManagedSemanticPlanInput;
}) {
  const visibleResponse = input.action === "ask"
    ? input.visibleTurn?.question
    : input.action === "honest_limit"
      ? input.visibleTurn?.honestLimit
      : input.visibleTurn?.insight;
  const fallback = input.action === "ask"
    ? input.semanticPlan.expectedUnderstandingDelta ?? input.semanticPlan.selectedTargetId ?? "继续理解当前线索"
    : input.action === "honest_limit"
      ? "先停在当前范围"
      : input.semanticPlan.expectedUnderstandingDelta ?? "保留当前形成的认识";
  const normalized = normalizeText(visibleResponse ?? fallback)
    .replace(/用户/gu, "你")
    .replace(/[。！!？?]+$/u, "");
  const bounded = Array.from(normalized).slice(0, 64).join("");
  return Array.from(bounded).length >= 4
    ? bounded
    : Array.from(normalizeText(fallback)).slice(0, 64).join("");
}

function withSystemManagedMicrogoalDelta(
  input: EventCenteredGenerativeGenerationInput,
  plan: {
    understanding: EventCenteredGenerativeTurn["understanding"];
    semanticPlan: SystemManagedSemanticPlanInput;
    visibleTurn?: EventCenteredProviderGenerativeTurn["visibleTurn"];
  }
) {
  const explicitCorrection = isExplicitEventCenteredCorrection(input.rawText);
  const recordedCorrection = plan.understanding.correctionOrBoundary?.kind === "correction"
    ? plan.understanding.correctionOrBoundary
    : null;
  const understanding: EventCenteredGenerativeTurn["understanding"] = {
    ...plan.understanding,
    answerStatus: explicitCorrection
      ? "correction"
      : plan.understanding.answerStatus === "correction"
        ? "answered"
        : plan.understanding.answerStatus,
    correctionOrBoundary: explicitCorrection
      ? recordedCorrection ?? {
          kind: "correction",
          reason: "用户明确修正了上一层理解"
        }
      : recordedCorrection
        ? null
        : plan.understanding.correctionOrBoundary,
    factDeltas: plan.understanding.factDeltas.filter((fact) =>
      input.rawText.includes(fact.quote)
    )
  };
  const providedRealizationContract = plan.semanticPlan.realizationContract;
  const semanticPlan: EventCenteredGenerativeTurn["semanticPlan"] = {
    ...plan.semanticPlan,
    microgoalDelta: null,
    realizationContract: {
      responseCore: providedRealizationContract?.responseCore.replace(/用户/gu, "你") ??
        compatibilityResponseCore({
          action: plan.semanticPlan.action,
          visibleTurn: plan.visibleTurn,
          semanticPlan: plan.semanticPlan
        }),
      summaryAnchors: providedRealizationContract?.summaryAnchors ?? []
    }
  };
  if (
    (semanticPlan.action === "complete" || semanticPlan.action === "pause") &&
    !semanticPlan.expectedUnderstandingDelta
  ) {
    semanticPlan.expectedUnderstandingDelta =
      semanticPlan.outcomeAssessment?.basis ??
      plan.visibleTurn?.insight ??
      "保留当前已经形成的认识";
  }
  if (semanticPlan.action !== "ask" && !semanticPlan.stopReason) {
    semanticPlan.stopReason = semanticPlan.outcomeAssessment?.basis ??
      (semanticPlan.action === "honest_limit"
        ? "当前材料只支持诚实收束"
        : "当前成果已经达到问停条件");
  }
  const requiredAnchorCount = 1;
  const userClauses = [
    input.rawText,
    ...input.recentTurns.map((turn) => turn.user)
  ].flatMap(completeRealizationClauses);
  const factStatementsByRef = new Map<string, string>([
    ...input.facts.map((fact) => [fact.id, normalizeText(fact.statement)] as const),
    ...understanding.factDeltas.map((fact, index) => [
      `new:${index + 1}`,
      normalizeText(fact.statement)
    ] as const)
  ]);
  const completeFactStatements = [...factStatementsByRef.values()].filter((statement) =>
    Array.from(statement).length >= 2 && Array.from(statement).length <= 280
  );
  const completeAnchorSources = [...userClauses, ...completeFactStatements];
  const mappedProvidedAnchors = semanticPlan.realizationContract.summaryAnchors
    .map((anchor) => completeAnchorSources.find((source) =>
      isEventCenteredGenerativeAnchorTraceable(anchor, [source])
    ) ?? null)
    .filter((anchor): anchor is string => Boolean(anchor));
  const evidenceAnchors = semanticPlan.evidenceRefs
    .map((ref) => factStatementsByRef.get(ref) ?? null)
    .filter((anchor): anchor is string => Boolean(anchor))
    .filter((anchor) => Array.from(anchor).length <= 280);
  semanticPlan.realizationContract.summaryAnchors = [...new Set([
    ...mappedProvidedAnchors,
    ...evidenceAnchors,
    ...userClauses
  ])].slice(0, requiredAnchorCount);
  if (getEventCenteredGenerativeMode(input.phase) !== "deep") {
    semanticPlan.progressAssessment = "not_applicable";
    return { ...plan, understanding, semanticPlan };
  }

  semanticPlan.progressAssessment = semanticPlan.action === "ask" ||
    semanticPlan.action === "honest_limit"
    ? "no_increment"
    : understanding.answerStatus === "correction"
      ? "correction_update"
      : semanticPlan.outcomeAssessment?.origin === "ai_synthesized"
        ? "ai_new_relation"
        : "user_new_understanding";

  const currentMicrogoal = input.microgoal?.status === "active"
    ? input.microgoal
    : null;
  const statement = currentMicrogoal?.statement ??
    semanticPlan.expectedUnderstandingDelta ??
    semanticPlan.selectedTargetId;

  if (semanticPlan.action === "ask") {
    semanticPlan.microgoalDelta = {
      operation: currentMicrogoal ? "continue" : "start",
      statement,
      supportEvidenceRefs: semanticPlan.evidenceRefs.slice(0, 6)
    };
  } else if (semanticPlan.action === "pause") {
    semanticPlan.microgoalDelta = {
      operation: "complete",
      statement,
      supportEvidenceRefs: semanticPlan.evidenceRefs.slice(0, 6)
    };
  } else if (semanticPlan.action === "honest_limit" && currentMicrogoal) {
    semanticPlan.microgoalDelta = {
      operation: "close",
      statement: currentMicrogoal.statement,
      supportEvidenceRefs: semanticPlan.evidenceRefs.slice(0, 6)
    };
  }

  return { ...plan, understanding, semanticPlan };
}

function boundedCompatibilityText(value: string, fallback: string, maxLength: number) {
  const normalized = normalizeText(value).replace(/[。！!？?]+$/u, "");
  const bounded = Array.from(normalized).slice(0, maxLength).join("");
  return Array.from(bounded).length >= 4 ? bounded : fallback;
}

function semanticFrameCompatibilityStatement(input: {
  semanticFrame: EventCenteredSemanticFrame | null;
  evidenceByRef: Map<string, Omit<FrozenEvidenceStatement, "ref">>;
}) {
  if (!input.semanticFrame) return null;
  const unitTextById = new Map(input.semanticFrame.units.map((unit) => {
    const texts = unit.evidenceRefs.flatMap((ref) => {
      const evidence = input.evidenceByRef.get(ref);
      return evidence ? [normalizeText(evidence.statement)] : [];
    });
    return [unit.id, [...new Set(texts)].join("、")] as const;
  }));
  const relation = input.semanticFrame.relation;
  let statement = relation
    ? (() => {
        const from = unitTextById.get(relation.fromUnitId) ?? "当前线索";
        const to = unitTextById.get(relation.toUnitId) ?? "相关变化";
        if (relation.type === "sequence") return `${from}，随后${to}`;
        if (relation.type === "contrast") return `${from}，同时存在另一面：${to}`;
        if (relation.type === "condition") return `${from}时，${to}`;
        if (relation.type === "change_effect") return `${from}，对应的结果是${to}`;
        if (relation.type === "user_stated_reason") return `${from}，用户明确给出的原因是${to}`;
        return `${from}，同时${to}`;
      })()
    : unitTextById.get(input.semanticFrame.units[0]!.id) ?? "当前可确认的内容";
  const relationUnitIds = new Set(
    relation ? [relation.fromUnitId, relation.toUnitId] : []
  );
  const remainingUnitTexts = input.semanticFrame.units
    .filter((unit) => !relationUnitIds.has(unit.id))
    .map((unit) => unitTextById.get(unit.id))
    .filter((value): value is string => Boolean(value));
  if (relation && remainingUnitTexts.length > 0) {
    statement = `${statement}；${remainingUnitTexts.join("；")}`;
  }
  return boundedCompatibilityText(statement, "当前可确认的内容", 280);
}

function compatibilityQuestionIntent(
  questionIntent: EventCenteredSemanticQuestionIntent | null
): EventCenteredQuestionIntent | null {
  if (!questionIntent) return null;
  const { answerSource } = questionIntent;
  const entryByKind: Record<typeof answerSource.kind, string> = {
    sensory_detail: `从“${answerSource.anchorQuote}”里的感官细节继续确认`,
    observable_action: `从“${answerSource.anchorQuote}”前后的可观察动作继续确认`,
    exact_words: `从“${answerSource.anchorQuote}”这句原话继续确认`,
    mental_image: `从“${answerSource.anchorQuote}”对应的具体画面继续确认`,
    change_moment: `从“${answerSource.anchorQuote}”对应的变化时刻继续确认`,
    direct_comparison: `从“${answerSource.anchorQuote}”对应的直接比较继续确认`
  };
  return {
    goal: questionIntent.gap,
    answerEntry: boundedCompatibilityText(
      entryByKind[answerSource.kind],
      "从当前证据的具体片段继续确认",
      280
    ),
    evidenceRefs: answerSource.evidenceRefs
  };
}

function compatibilityLimitReason(
  limitReason: EventCenteredSemanticLimitReason | null
) {
  if (!limitReason) return null;
  const reasonByKind: Record<typeof limitReason.kind, string> = {
    insufficient_evidence: "当前材料不足以形成可靠认识",
    no_safe_question: "当前缺少安全且具体的继续入口",
    user_boundary: "用户已明确希望停在当前范围"
  };
  return reasonByKind[limitReason.kind];
}

function cognitiveActionForAnswerSource(
  questionIntent: EventCenteredSemanticQuestionIntent | null
): EventCenteredCognitiveAction | null {
  const kind = questionIntent?.answerSource.kind;
  if (!kind) return null;
  if (kind === "change_moment") return "trace_change";
  if (kind === "direct_comparison") return "differentiate";
  if (kind === "exact_words") return "clarify_user_term";
  return "anchor_specific";
}

function normalizeSemanticTargetIdentityText(value: string) {
  return normalizeText(value).replace(/[\s。！？!?;；，,]+$/gu, "");
}

function shouldReuseCurrentSemanticTarget(
  input: EventCenteredGenerativeGenerationInput,
  providerPlan: EventCenteredTwoStageV4ProviderPlan
) {
  const currentIntent = resolveGenerationCurrentQuestionIntent(input);
  const nextGap = providerPlan.questionIntent?.gap;
  const sameGap = Boolean(currentIntent && nextGap) &&
    normalizeSemanticTargetIdentityText(currentIntent?.semanticGoal ?? "") ===
    normalizeSemanticTargetIdentityText(nextGap ?? "");
  return Boolean(input.currentQuestionTarget) && sameGap && (
    providerPlan.understanding.answerStatus === "partly_answered" ||
    hasAvailableGenerativeUnableAnswerRepair(input)
  );
}

/**
 * Provider v4 的语义骨架统一从这里投影到既有内部协议。兼容文案只服务
 * 状态、Trace 与旧下游；第二段表达层直接读取原始骨架与冻结证据。
 */
export function deriveEventCenteredGenerativePlanFromSemanticSkeleton(
  input: EventCenteredGenerativeGenerationInput,
  providerPlan: EventCenteredTwoStageV4ProviderPlan
): {
  understanding: EventCenteredGenerativeTurn["understanding"];
  semanticPlan: EventCenteredGenerativeTurn["semanticPlan"];
  understandingCard: EventCenteredUnderstandingCard | null;
  questionIntent: EventCenteredQuestionIntent | null;
  limitReason: string | null;
} {
  const { decision, semanticFrame } = providerPlan;
  const action = deriveTwoStageAction({ state: decision.state, phase: input.phase });
  if (!action) throw new Error("EVENT_GENERATIVE_PLAN_ACTION_UNMAPPABLE");

  const evidenceByRef = buildSemanticEvidenceByRef({
    generationInput: input,
    understanding: {
      ...providerPlan.understanding,
      tentativeInterpretation: null
    }
  });
  const understandingStatement = semanticFrameCompatibilityStatement({
    semanticFrame,
    evidenceByRef
  });
  const understandingCard = understandingStatement && semanticFrame
    ? {
        statement: understandingStatement,
        evidenceRefs: [...new Set(semanticFrame.units.flatMap((unit) => unit.evidenceRefs))]
      }
    : null;
  const questionIntent = compatibilityQuestionIntent(providerPlan.questionIntent);
  const limitReason = compatibilityLimitReason(providerPlan.limitReason);
  const evidenceRefs = semanticSkeletonEvidenceRefs({
    semanticFrame,
    questionIntent: providerPlan.questionIntent,
    limitReason: providerPlan.limitReason
  });
  /** 成果归属只能由看过用户原话的第一段判断，兼容层直接透传。 */
  const compatibilityOrigin = decision.origin;
  const tentativeInterpretation = decision.state === "ready" &&
    compatibilityOrigin === "ai_synthesized" &&
    understandingCard
    ? {
        statement: understandingCard.statement,
        supportEvidenceRefs: understandingCard.evidenceRefs
      }
    : null;
  const understanding: EventCenteredGenerativeTurn["understanding"] = {
    ...providerPlan.understanding,
    tentativeInterpretation
  };
  const semanticPlan: SystemManagedSemanticPlanInput = {
    action,
    activeAngle: input.activeAngle,
    progressAssessment: decision.progressAssessment,
    outcomeAssessment: {
      state: decision.state,
      origin: compatibilityOrigin,
      basis: normalizeText(
        understandingCard?.statement ?? questionIntent?.goal ?? limitReason ?? "当前只保留可确认范围"
      ).padEnd(8, "。"),
      supportEvidenceRefs: evidenceRefs,
      missingUnderstanding: decision.state === "needs_more" ? questionIntent?.goal ?? null : null
    },
    evidenceRefs,
    insightKind: decision.state === "ready"
      ? evidenceRefs.length >= 2 ? "connection" : "distinction"
      : decision.state === "limited" ? "scope_only" : null,
    selectedTargetId: decision.state === "needs_more"
      ? shouldReuseCurrentSemanticTarget(input, providerPlan)
        ? input.currentQuestionTarget
        : `v4:${createPromptEnvelope({
          promptKey: "interview.event_centered.generative_target",
          promptVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
          messages: [{
            role: "user",
            content: providerPlan.questionIntent?.gap ?? "继续理解当前线索"
          }]
        }).resolvedPromptHash.slice(0, 16)}`
      : null,
    expectedUnderstandingDelta: decision.state === "needs_more"
      ? questionIntent?.goal.padEnd(8, "。") ?? null
      : decision.state === "ready"
        ? understandingCard?.statement.padEnd(8, "。") ?? null
        : null,
    tentativeInterpretation,
    stopReason: decision.state === "needs_more"
      ? null
      : normalizeText(limitReason ?? understandingCard?.statement ?? "当前成果已经达到问停条件"),
    cognitiveAction: decision.state === "needs_more"
      ? cognitiveActionForAnswerSource(providerPlan.questionIntent)
      : null,
    microgoalDelta: null,
    realizationContract: {
      responseCore: boundedCompatibilityText(
        decision.state === "needs_more"
          ? questionIntent?.goal ?? "继续理解当前线索"
          : understandingCard?.statement ?? limitReason ?? "保留当前形成的认识",
        decision.state === "limited" ? "先停在当前范围" : "保留当前形成的认识",
        64
      ),
      summaryAnchors: []
    }
  };
  const systemManaged = withSystemManagedMicrogoalDelta(input, {
    understanding,
    semanticPlan
  });
  return {
    understanding: systemManaged.understanding,
    semanticPlan: systemManaged.semanticPlan,
    understandingCard,
    questionIntent,
    limitReason
  };
}

async function generateOneCall(input: EventCenteredGenerativeGenerationInput & {
  provider: AIProvider | null;
}): Promise<EventCenteredGenerativeGenerationResult> {
  const attempts: StructuredOutputAttempt[] = [];
  const promptLineage: EventCenteredAIGenerationResult["promptLineage"] = [];
  const built = buildGenerativeTurnMessages(input);
  const fewShotIds = built.examples.map((example) => example.id);
  const maximumFullAttempts = Math.max(1, Math.min(2, input.maxAttempts ?? 2));
  const actionContentConflictIssues = new Set([
    "ask_summary_already_answers_question",
    "ask_question_only_requests_known_fact"
  ]);
  const strategyVersion = input.completeResponseFirst
    ? EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_VERSION
    : EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION;
  let retryIssues: string[] = [];
  let retryErrorCode: "ACTION_CONTENT_CONFLICT" | "OUTPUT_VALIDATION_FAILED" | null = null;

  for (let attemptIndex = 0; attemptIndex < maximumFullAttempts; attemptIndex += 1) {
    const messages = retryIssues.length === 0
      ? built.messages
      : built.messages.map((message, messageIndex) => messageIndex === 0
          ? {
              ...message,
              content: [
                message.content,
                retryErrorCode === "ACTION_CONTENT_CONFLICT"
                  ? `技术重试：上一输出出现 ${retryIssues.join("、")}。ask 的思路只能说明已知线索和提问价值，不能给出正式问题的答案；问题必须询问当前事实仍未提供的内容，不能再次收集已有事实。请重新完成同一回合。`
                  : `技术重试：上一输出违反客观输出约束（${retryIssues.join("、")}）。保持同一用户事实、角度和目标，修正结构、边界或可见表达后重新输出完整回合。`
              ].join("\n")
            }
          : message
        );
    const envelope = createPromptEnvelope({
      promptKey: "interview.event_centered.generative_turn",
      promptVersion: EVENT_CENTERED_GENERATIVE_TURN_PROMPT_VERSION,
      messages
    });
    promptLineage.push({
      promptKey: envelope.promptKey,
      promptVersion: envelope.promptVersion,
      resolvedPromptHash: envelope.resolvedPromptHash
    });
    const attemptOffset = attempts.length;
    const generated = await completeStructuredOutput<EventCenteredProviderGenerativeTurn>({
      provider: input.provider,
      stage: "question",
      schema: eventCenteredProviderGenerativeTurnSchema,
      messages: envelope.messages,
      temperature: 0.2,
      maxTokens: input.maxTokens ?? 1500,
      maxAttempts: 1,
      timeoutMs: input.timeoutMs ?? 12_000,
      responseFormat: "json_object",
      thinking: "disabled",
      signal: input.signal,
      onAttempt: (item) => {
        attempts.push(item);
      }
    });
    if (!generated) {
      if (attemptIndex + 1 < maximumFullAttempts) continue;
      return failedGenerativeResult({
        provider: input.provider,
        attempts,
        promptLineage,
        validationIssues: attemptIssues(attempts),
        fewShotIds,
        architecture: "one_call",
        strategyVersion
      });
    }

    const parsedGenerated = eventCenteredProviderGenerativeTurnSchema.safeParse(generated);
    if (!parsedGenerated.success) {
      const schemaIssues = parsedGenerated.error.issues.map((issue) =>
        `SCHEMA:${issue.path.join(".")}:${issue.message}`
      );
      if (attemptIndex + 1 < maximumFullAttempts) {
        retryIssues = schemaIssues;
        retryErrorCode = "OUTPUT_VALIDATION_FAILED";
        continue;
      }
      return failedGenerativeResult({
        provider: input.provider,
        attempts,
        promptLineage,
        validationIssues: schemaIssues,
        fewShotIds,
        architecture: "one_call",
        strategyVersion
      });
    }
    const systemManaged = withSystemManagedMicrogoalDelta(input, parsedGenerated.data);
    const normalizedGenerated = eventCenteredGenerativeTurnSchema.parse({
      understanding: systemManaged.understanding,
      semanticPlan: systemManaged.semanticPlan,
      visibleTurn: parsedGenerated.data.visibleTurn
    });
    const bounded = enforceGenerativeSystemBoundaries({
      turn: normalizedGenerated,
      rawText: input.rawText,
      activeAngle: input.activeAngle,
      phase: input.phase,
      currentQuestionTarget: input.currentQuestionTarget,
      currentQuestionSurfaceLevel: input.currentQuestionSurfaceLevel,
      guidedQuestionOpportunityCount: input.guidedQuestionOpportunityCount,
      microgoalQuestionCount: input.microgoal?.questionCount ?? 0
    });
    const validation = validateGeneratedTurn(input, bounded);
    const partitionedValidation = partitionEventCenteredGenerativeValidationIssues(
      validation.issues
    );
    if (
      partitionedValidation.hardIssues.length > 0 &&
      attemptIndex + 1 < maximumFullAttempts &&
      !partitionedValidation.hardIssues.some(isEventCenteredGenerativeImmediateFallbackIssue)
    ) {
      const onlyActionContentConflicts = partitionedValidation.hardIssues.every((issue) =>
        actionContentConflictIssues.has(issue)
      );
      const validationErrorCode = onlyActionContentConflicts
        ? "ACTION_CONTENT_CONFLICT" as const
        : "OUTPUT_VALIDATION_FAILED" as const;
      for (let index = attempts.length - 1; index >= attemptOffset; index -= 1) {
        const attempt = attempts[index];
        if (!attempt?.success) continue;
        attempts[index] = {
          ...attempt,
          success: false,
          errorCode: validationErrorCode,
          errorMessage: partitionedValidation.hardIssues.join(";")
        };
        break;
      }
      retryIssues = partitionedValidation.hardIssues;
      retryErrorCode = validationErrorCode;
      continue;
    }
    if (partitionedValidation.hardIssues.length > 0) {
      return failedGenerativeResult({
        provider: input.provider,
        attempts,
        promptLineage,
        validationIssues: partitionedValidation.hardIssues,
        qualityDiagnostics: partitionedValidation.qualityDiagnostics,
        fewShotIds,
        architecture: "one_call",
        strategyVersion
      });
    }

    return {
      turn: bounded,
      semanticArtifact: null,
      outputOrigin: "llm",
      attempts,
      promptLineage,
      validationIssues: [],
      qualityDiagnostics: partitionedValidation.qualityDiagnostics,
      strategyVersion,
      angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
      fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
      fewShotIds,
      architecture: "one_call"
    };
  }

  return failedGenerativeResult({
    provider: input.provider,
    attempts,
    promptLineage,
    validationIssues: attemptIssues(attempts),
    fewShotIds,
    architecture: "one_call",
    strategyVersion
  });
}

async function generateEventCenteredGenerativeSemanticPlanAttempt(
  input: EventCenteredGenerativeGenerationInput
): Promise<EventCenteredGenerativeSemanticPlanStageResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];
  const promptLineage: EventCenteredAIGenerationResult["promptLineage"] = [];
  const { built: builtPlan, envelope: planEnvelope } = buildSemanticPlanEnvelope(input);
  const fewShotIds = builtPlan.examples.map((example) => example.id);
  promptLineage.push({
    promptKey: planEnvelope.promptKey,
    promptVersion: planEnvelope.promptVersion,
    resolvedPromptHash: planEnvelope.resolvedPromptHash
  });
  let plan: unknown;
  try {
    plan = await completeStructuredOutput({
      provider,
      stage: "extract",
      schema: eventCenteredTwoStageV4GenerativePlanSchema,
      messages: planEnvelope.messages,
      temperature: 0.2,
      maxTokens: input.maxTokens ?? EVENT_CENTERED_SEMANTIC_PLAN_MAX_TOKENS,
      maxAttempts: 1,
      timeoutMs: input.timeoutMs ?? 12_000,
      responseFormat: "json_object",
      thinking: "disabled",
      signal: input.signal,
      onAttempt: (item) => {
        attempts.push(item);
      }
    });
  } catch (error) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: [generationExceptionIssue("PLAN_REQUEST", error)],
      fewShotIds
    });
  }
  if (!plan) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: attemptIssues(attempts),
      fewShotIds
    });
  }
  const parsedPlan = eventCenteredTwoStageV4GenerativePlanSchema.safeParse(plan);
  if (!parsedPlan.success) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: parsedPlan.error.issues.map((issue) =>
        `PLAN_SCHEMA:${issue.path.join(".")}:${issue.message}`
      ),
      fewShotIds
    });
  }
  const correctionDetected = Boolean(input.correctionRequested) ||
    isExplicitEventCenteredCorrection(input.rawText);
  const correctedPlan = ensureCorrectionEvidenceCoverage({
    plan: parsedPlan.data,
    correctionDetected
  });
  const originNormalizedPlan = normalizeUserArticulatedRelationOrigin({
    plan: correctedPlan,
    generationInput: input
  });
  const normalizedPlan = normalizeDeepProgressAssessment({
    plan: originNormalizedPlan,
    generationInput: input
  });
  const normalizedProviderPlan = eventCenteredTwoStageV4GenerativePlanSchema.safeParse(
    normalizedPlan
  );
  if (!normalizedProviderPlan.success) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: normalizedProviderPlan.error.issues.map((issue) =>
        `PLAN_NORMALIZATION_SCHEMA:${issue.path.join(".")}:${issue.message}`
      ),
      fewShotIds
    });
  }
  const providerPlan = normalizedProviderPlan.data;
  const providerUnderstanding = {
    ...providerPlan.understanding,
    tentativeInterpretation: null
  };
  const currentTurnCoverageIssues = validateCurrentTurnMaterialCoverage({
    rawText: input.rawText,
    correctionDetected,
    plan: providerPlan
  });
  const currentTurnCoverageDiagnostics = currentTurnCoverageIssues.filter((issue) =>
    issue.startsWith("CURRENT_TURN_CONTENT_OMITTED:")
  );
  const currentTurnCoverageHardIssues = currentTurnCoverageIssues.filter((issue) =>
    !issue.startsWith("CURRENT_TURN_CONTENT_OMITTED:")
  );
  if (currentTurnCoverageHardIssues.length > 0) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: currentTurnCoverageHardIssues,
      qualityDiagnostics: currentTurnCoverageDiagnostics,
      fewShotIds
    });
  }
  const semanticEvidenceIssues = validateSemanticSkeletonEvidence({
    semanticFrame: providerPlan.semanticFrame,
    questionIntent: providerPlan.questionIntent,
    limitReason: providerPlan.limitReason,
    evidenceByRef: buildSemanticEvidenceByRef({
      generationInput: input,
      understanding: providerUnderstanding
    })
  });
  if (semanticEvidenceIssues.length > 0) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: semanticEvidenceIssues,
      qualityDiagnostics: currentTurnCoverageDiagnostics,
      fewShotIds
    });
  }
  let systemManagedPlan: ReturnType<
    typeof deriveEventCenteredGenerativePlanFromSemanticSkeleton
  >;
  try {
    systemManagedPlan = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      input,
      providerPlan
    );
  } catch (error) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: [generationExceptionIssue("ASSEMBLY", error)],
      fewShotIds
    });
  }
  const parsedSystemManagedPlan = eventCenteredGenerativePlanSchema.safeParse(
    {
      understanding: systemManagedPlan.understanding,
      semanticPlan: systemManagedPlan.semanticPlan
    }
  );
  if (!parsedSystemManagedPlan.success) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: parsedSystemManagedPlan.error.issues.map((issue) =>
        `PLAN_ASSEMBLY_SCHEMA:${issue.path.join(".")}:${issue.message}`
      ),
      fewShotIds
    });
  }
  const planValidation = validateGeneratedSemanticPlan(
    input,
    systemManagedPlan,
    providerPlan.limitReason?.kind ?? null
  );
  const partitionedPlanValidation = partitionEventCenteredGenerativeValidationIssues(
    planValidation.issues
  );
  if (partitionedPlanValidation.hardIssues.length > 0) {
    return failedSemanticPlanStageResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: partitionedPlanValidation.hardIssues,
      qualityDiagnostics: [
        ...currentTurnCoverageDiagnostics,
        ...partitionedPlanValidation.qualityDiagnostics
      ],
      fewShotIds
    });
  }

  const evidenceStatements = collectFrozenEvidenceStatements({
    generationInput: input,
    understanding: parsedSystemManagedPlan.data.understanding,
    semanticFrame: providerPlan.semanticFrame,
    questionIntent: providerPlan.questionIntent,
    limitReason: providerPlan.limitReason
  });
  const semanticPlanHash = createSemanticPlanArtifactHash({
    understanding: parsedSystemManagedPlan.data.understanding,
    decisionOrigin: providerPlan.decision.origin,
    semanticFrame: providerPlan.semanticFrame,
    providerQuestionIntent: providerPlan.questionIntent,
    providerLimitReason: providerPlan.limitReason,
    understandingCard: systemManagedPlan.understandingCard,
    questionIntent: systemManagedPlan.questionIntent,
    limitReason: systemManagedPlan.limitReason,
    semanticPlan: parsedSystemManagedPlan.data.semanticPlan,
    evidenceStatements
  });
  const artifact = JSON.parse(JSON.stringify({
    artifactVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
    inputBinding: {
      phase: input.phase,
      activeAngle: input.activeAngle,
      currentQuestionTarget: input.currentQuestionTarget,
      planPromptHash: planEnvelope.resolvedPromptHash,
      semanticPlanHash,
      retryIssues: retryableGenerativeValidationIssues(input.retryIssues ?? [])
    },
    understanding: parsedSystemManagedPlan.data.understanding,
    decisionState: providerPlan.decision.state,
    decisionOrigin: providerPlan.decision.origin,
    decisionProgressAssessment: providerPlan.decision.progressAssessment,
    semanticFrame: providerPlan.semanticFrame,
    providerQuestionIntent: providerPlan.questionIntent,
    providerLimitReason: providerPlan.limitReason,
    understandingCard: systemManagedPlan.understandingCard,
    questionIntent: systemManagedPlan.questionIntent,
    limitReason: systemManagedPlan.limitReason,
    semanticPlan: parsedSystemManagedPlan.data.semanticPlan,
    evidenceStatements,
    strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    fewShotIds,
    promptVersion: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
    promptLineage
  })) as EventCenteredGenerativeSemanticPlanArtifact;

  return {
    artifact,
    outputOrigin: "llm",
    attempts,
    promptLineage,
    validationIssues: [],
    qualityDiagnostics: [
      ...currentTurnCoverageDiagnostics,
      ...partitionedPlanValidation.qualityDiagnostics
    ],
    strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    fewShotIds,
    architecture: "two_call"
  };
}

export async function generateEventCenteredGenerativeSemanticPlanAI(
  input: EventCenteredGenerativeGenerationInput
): Promise<EventCenteredGenerativeSemanticPlanStageResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const results: EventCenteredGenerativeSemanticPlanStageResult[] = [];
  const maximumAttempts = Math.max(1, Math.min(2, input.maxAttempts ?? 2));
  let retryIssues = retryableGenerativeValidationIssues(input.retryIssues ?? []);
  for (let index = 0; index < maximumAttempts; index += 1) {
    const result = await generateEventCenteredGenerativeSemanticPlanAttempt({
      ...input,
      provider,
      retryIssues
    });
    await input.onSemanticAttemptResult?.({
      attemptIndex: index + 1,
      success: Boolean(result.artifact),
      validationIssues: result.validationIssues,
      artifact: result.artifact
    });
    results.push(result);
    if (result.artifact) {
      return {
        ...result,
        attempts: results.flatMap((item) => item.attempts),
        promptLineage: uniqueGenerativePromptLineage(
          ...results.map((item) => item.promptLineage)
        ),
        qualityDiagnostics: [...new Set([
          ...results.flatMap((item) => item.qualityDiagnostics),
          ...results.slice(0, -1).flatMap((item) =>
            item.validationIssues.map((issue) => `semantic_retry:${issue}`)
          )
        ])]
      };
    }
    if (result.validationIssues.some(isEventCenteredGenerativeImmediateFallbackIssue)) {
      return {
        ...result,
        attempts: results.flatMap((item) => item.attempts),
        promptLineage: uniqueGenerativePromptLineage(
          ...results.map((item) => item.promptLineage)
        ),
        validationIssues: [...new Set(results.flatMap((item) => item.validationIssues))],
        qualityDiagnostics: [...new Set(results.flatMap((item) => item.qualityDiagnostics))]
      };
    }
    retryIssues = retryableGenerativeValidationIssues(result.validationIssues);
    if (index + 1 < maximumAttempts) {
      if (needsTransientGenerativeRetry(result.validationIssues)) {
        await input.onRetry?.({
          stage: "semantic",
          attempt: 1,
          reasonCodes: result.validationIssues
        });
      }
      await waitForTransientGenerativeRetry({
        issues: result.validationIssues,
        signal: input.signal
      });
    }
    input.signal?.throwIfAborted();
  }
  const finalResult = results.at(-1)!;
  return {
    ...finalResult,
    attempts: results.flatMap((item) => item.attempts),
    promptLineage: uniqueGenerativePromptLineage(
      ...results.map((item) => item.promptLineage)
    ),
    validationIssues: [...new Set(results.flatMap((item) => item.validationIssues))],
    qualityDiagnostics: [...new Set(results.flatMap((item) => item.qualityDiagnostics))]
  };
}

const TWO_STAGE_OBSOLETE_COMPATIBILITY_DIAGNOSTICS = new Set([
  "visible_response_must_preserve_response_core"
]);

export async function generateEventCenteredGenerativeVisibleTurnAI(
  input: EventCenteredGenerativeGenerationInput & {
    artifact: EventCenteredGenerativeSemanticPlanArtifact;
  }
): Promise<EventCenteredGenerativeVisibleStageResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];
  const promptLineage = [...input.artifact.promptLineage];
  const { built: expectedPlanBuild, envelope: expectedPlanEnvelope } =
    buildSemanticPlanEnvelope({
      ...input,
      retryIssues: input.artifact.inputBinding.retryIssues ?? []
    });
  const expectedFewShotIds = expectedPlanBuild.examples.map((example) => example.id);
  const fail = (
    validationIssues: string[],
    qualityDiagnostics: string[] = []
  ): EventCenteredGenerativeVisibleStageResult => ({
    ...failedGenerativeResult({
      provider,
      attempts,
      promptLineage,
      validationIssues,
      qualityDiagnostics,
      fewShotIds: input.artifact.fewShotIds,
      architecture: "two_call"
    }),
    semanticArtifact: input.artifact,
    artifact: input.artifact
  });
  const bindingIssues = validateSemanticPlanArtifactBinding({
    generationInput: input,
    artifact: input.artifact,
    expectedPlanPromptHash: expectedPlanEnvelope.resolvedPromptHash,
    expectedFewShotIds
  });
  if (bindingIssues.length > 0) return fail(bindingIssues);

  const { tentativeInterpretation: _compatInterpretation, ...providerUnderstanding } =
    input.artifact.understanding;
  void _compatInterpretation;
  const parsedProviderPlan = eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
    understanding: providerUnderstanding,
    decision: {
      state: input.artifact.decisionState,
      origin: input.artifact.decisionOrigin,
      progressAssessment: input.artifact.decisionProgressAssessment
    },
    semanticFrame: input.artifact.semanticFrame,
    questionIntent: input.artifact.providerQuestionIntent,
    limitReason: input.artifact.providerLimitReason
  });
  if (!parsedProviderPlan.success) {
    return fail(parsedProviderPlan.error.issues.map((issue) =>
      `SEMANTIC_PLAN_V4_SCHEMA:${issue.path.join(".")}:${issue.message}`
    ));
  }
  const parsedArtifactPlan = eventCenteredGenerativePlanSchema.safeParse({
    understanding: input.artifact.understanding,
    semanticPlan: input.artifact.semanticPlan
  });
  if (!parsedArtifactPlan.success) {
    return fail(parsedArtifactPlan.error.issues.map((issue) =>
      `SEMANTIC_PLAN_ARTIFACT_SCHEMA:${issue.path.join(".")}:${issue.message}`
    ));
  }
  const frozenPlan = {
    ...input.artifact,
    semanticFrame: parsedProviderPlan.data.semanticFrame,
    providerQuestionIntent: parsedProviderPlan.data.questionIntent,
    providerLimitReason: parsedProviderPlan.data.limitReason,
    understanding: parsedArtifactPlan.data.understanding,
    semanticPlan: parsedArtifactPlan.data.semanticPlan
  };
  const planValidation = validateGeneratedSemanticPlan(
    input,
    frozenPlan,
    frozenPlan.providerLimitReason?.kind ?? null
  );
  const partitionedPlanValidation = partitionEventCenteredGenerativeValidationIssues(
    planValidation.issues
  );
  if (partitionedPlanValidation.hardIssues.length > 0) {
    return fail(
      partitionedPlanValidation.hardIssues,
      partitionedPlanValidation.qualityDiagnostics
    );
  }

  const visibleMessages = buildVisibleTurnMessages({ ...input, artifact: frozenPlan });
  const visibleEnvelope = createPromptEnvelope({
    promptKey: "interview.event_centered.generative_visible_turn",
    promptVersion: EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION,
    messages: visibleMessages
  });
  promptLineage.push({
    promptKey: visibleEnvelope.promptKey,
    promptVersion: visibleEnvelope.promptVersion,
    resolvedPromptHash: visibleEnvelope.resolvedPromptHash
  });
  let visibleTurn: EventCenteredLockedGenerativeVisibleResult | null;
  try {
    visibleTurn = await completeStructuredOutput<EventCenteredLockedGenerativeVisibleResult>({
      provider,
      stage: "question",
      schema: eventCenteredLockedGenerativeVisibleSchema,
      messages: visibleEnvelope.messages,
      temperature: 0.2,
      maxTokens: input.maxTokens ?? EVENT_CENTERED_VISIBLE_TURN_MAX_TOKENS,
      maxAttempts: 1,
      timeoutMs: input.timeoutMs ?? 12_000,
      responseFormat: "json_object",
      thinking: "disabled",
      signal: input.signal,
      onAttempt: (item) => {
        attempts.push(item);
      }
    });
  } catch (error) {
    return fail([generationExceptionIssue("VISIBLE_REQUEST", error)]);
  }
  if (!visibleTurn) {
    return fail(attemptIssues(attempts));
  }
  if (visibleTurn.cannotExpressReason) {
    return fail([
      `VISIBLE_SEMANTIC_LOCK_UNEXPRESSIBLE:${visibleTurn.cannotExpressReason}`
    ]);
  }
  const action = frozenPlan.semanticPlan.action;
  const response = visibleTurn.response;
  if (!response) {
    return fail(["VISIBLE_RESPONSE_MISSING"]);
  }
  const lockedVisible = {
    thinkingSummary: visibleTurn.thinkingSummary,
    question: action === "ask" ? response : null,
    insight: action === "complete" || action === "pause" ? response : null,
    honestLimit: action === "honest_limit" ? response : null
  };

  const assembled = eventCenteredGenerativeTurnSchema.safeParse({
    understanding: frozenPlan.understanding,
    semanticPlan: frozenPlan.semanticPlan,
    visibleTurn: {
      thinkingSummary: lockedVisible.thinkingSummary,
      responseKind: canonicalVisibleResponseKind(action),
      question: lockedVisible.question,
      insight: lockedVisible.insight,
      honestLimit: lockedVisible.honestLimit
    }
  });
  if (!assembled.success) {
    return fail(assembled.error.issues.map((issue) =>
        `ASSEMBLY_SCHEMA:${issue.path.join(".")}:${issue.message}`
      ));
  }
  let bounded: EventCenteredGenerativeTurn;
  try {
    bounded = enforceGenerativeSystemBoundaries({
      turn: assembled.data,
      rawText: input.rawText,
      activeAngle: input.activeAngle,
      phase: input.phase,
      currentQuestionTarget: input.currentQuestionTarget,
      currentQuestionSurfaceLevel: input.currentQuestionSurfaceLevel,
      guidedQuestionOpportunityCount: input.guidedQuestionOpportunityCount,
      microgoalQuestionCount: input.microgoal?.questionCount ?? 0
    });
  } catch (error) {
    return fail([generationExceptionIssue("ASSEMBLY", error)]);
  }
  let validation = validateGeneratedTurn(input, bounded);
  const localRepairDiagnostics: string[] = [];
  const localThinkingSummaryRepair = repairThinkingSummaryDeterministically({
    turn: bounded,
    questionIntent: frozenPlan.providerQuestionIntent,
    validationIssues: validation.issues
  });
  if (localThinkingSummaryRepair) {
    const repairedValidation = validateGeneratedTurn(input, localThinkingSummaryRepair.turn);
    const remainingHardIssues = partitionEventCenteredGenerativeValidationIssues(
      repairedValidation.issues
    ).hardIssues.filter((issue) => issue !== "thinking_summary_direction_mismatch");
    if (remainingHardIssues.length === 0) {
      bounded = localThinkingSummaryRepair.turn;
      validation = {
        passed: repairedValidation.issues
          .filter((issue) => issue !== "thinking_summary_direction_mismatch").length === 0,
        issues: repairedValidation.issues.filter(
          (issue) => issue !== "thinking_summary_direction_mismatch"
        )
      };
      localRepairDiagnostics.push(localThinkingSummaryRepair.diagnostic);
    }
  }
  const partitionedValidation = partitionEventCenteredGenerativeValidationIssues([
    ...partitionedPlanValidation.qualityDiagnostics,
    ...validation.issues
  ]);
  const remainingQualityDiagnostics = partitionedValidation.qualityDiagnostics.filter(
    (issue) => !TWO_STAGE_OBSOLETE_COMPATIBILITY_DIAGNOSTICS.has(issue)
  );
  const hardIssues = partitionedValidation.hardIssues;
  if (hardIssues.length > 0) {
    return fail(hardIssues, remainingQualityDiagnostics);
  }

  return {
    turn: bounded,
    semanticArtifact: frozenPlan,
    artifact: frozenPlan,
    outputOrigin: "llm",
    attempts,
    promptLineage,
    validationIssues: [],
    qualityDiagnostics: [...new Set([
      ...remainingQualityDiagnostics,
      ...localRepairDiagnostics
    ])],
    strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    fewShotIds: frozenPlan.fewShotIds,
    architecture: "two_call"
  };
}

async function generateTwoCall(input: EventCenteredGenerativeGenerationInput & {
  provider: AIProvider | null;
}): Promise<EventCenteredGenerativeGenerationResult> {
  const planResult = await generateEventCenteredGenerativeSemanticPlanAI(input);
  if (!planResult.artifact) {
    return {
      turn: null,
      semanticArtifact: null,
      outputOrigin: planResult.outputOrigin,
      attempts: planResult.attempts,
      promptLineage: planResult.promptLineage,
      validationIssues: planResult.validationIssues,
      qualityDiagnostics: planResult.qualityDiagnostics,
      strategyVersion: planResult.strategyVersion,
      angleCardVersion: planResult.angleCardVersion,
      fewShotVersion: planResult.fewShotVersion,
      fewShotIds: planResult.fewShotIds,
      architecture: "two_call"
    };
  }
  const visibleResults: EventCenteredGenerativeVisibleStageResult[] = [];
  let retryIssues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await generateEventCenteredGenerativeVisibleTurnAI({
      ...input,
      artifact: planResult.artifact,
      retryIssues
    });
    visibleResults.push(result);
    if (result.turn) break;
    if (result.validationIssues.some(isEventCenteredGenerativeImmediateFallbackIssue)) break;
    retryIssues = retryableGenerativeValidationIssues(result.validationIssues);
    if (attempt + 1 < 2) {
      if (needsTransientGenerativeRetry(result.validationIssues)) {
        await input.onRetry?.({
          stage: "visible",
          attempt: 1,
          reasonCodes: result.validationIssues
        });
      }
      await waitForTransientGenerativeRetry({
        issues: result.validationIssues,
        signal: input.signal
      });
    }
    input.signal?.throwIfAborted();
  }
  const finalVisibleResult = visibleResults.at(-1)!;
  const { artifact, ...generationResult } = finalVisibleResult;
  void artifact;
  return {
    ...generationResult,
    semanticArtifact: planResult.artifact,
    attempts: [
      ...planResult.attempts,
      ...visibleResults.flatMap((result) => result.attempts)
    ],
    promptLineage: uniqueGenerativePromptLineage(
      planResult.promptLineage,
      ...visibleResults.map((result) => result.promptLineage)
    ),
    validationIssues: finalVisibleResult.turn
      ? finalVisibleResult.validationIssues
      : [...new Set(visibleResults.flatMap((result) => result.validationIssues))],
    qualityDiagnostics: [...new Set([
      ...planResult.qualityDiagnostics,
      ...visibleResults.flatMap((result) => result.qualityDiagnostics),
      ...collectEventCenteredVisibleRetryDiagnostics(visibleResults)
    ])]
  };
}

/**
 * 第二段只对技术或客观冲突重试。最终成功时保留之前失败的原因，
 * 供 Trace 和评测定位表达层稳定性；这些记录不参与运行时结果挑选。
 */
export function collectEventCenteredVisibleRetryDiagnostics(
  results: Array<Pick<
    EventCenteredGenerativeGenerationResult,
    "turn" | "validationIssues"
  >>
) {
  if (!results.at(-1)?.turn || results.length < 2) return [];
  return [...new Set(
    results.slice(0, -1).flatMap((result) =>
      result.validationIssues.map((issue) => `visible_retry:${issue}`)
    )
  )];
}

export async function generateEventCenteredGenerativeTurnAI(
  input: EventCenteredGenerativeGenerationInput & {
    architecture?: EventCenteredGenerativeArchitecture;
  }
): Promise<EventCenteredGenerativeGenerationResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const architecture = input.architecture ?? "one_call";
  if (architecture === "two_call") {
    return generateTwoCall({ ...input, provider });
  }
  return generateOneCall({ ...input, provider });
}

/**
 * v1.2 把本轮用户可见回应交给一次调用完整生成。模型只填写最小结构，
 * 服务端随后把它确定性映射到现有事实、问题状态与 Trace 写入链路。
 */
export async function generateEventCenteredCompleteResponseV12AI(
  input: EventCenteredGenerativeGenerationInput
): Promise<EventCenteredGenerativeGenerationResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];
  const messages = buildEventCenteredCompleteResponseFirstV12Messages(input);
  const envelope = createPromptEnvelope({
    promptKey: "interview.event_centered.complete_response_first_v1_2",
    promptVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION,
    messages
  });
  const promptLineage = [{
    promptKey: envelope.promptKey,
    promptVersion: envelope.promptVersion,
    resolvedPromptHash: envelope.resolvedPromptHash
  }];
  const output = await completeStructuredOutput<EventCenteredCompleteResponseFirstV12Output>({
    provider,
    stage: "question",
    schema: eventCenteredCompleteResponseFirstV12OutputSchema,
    messages: envelope.messages,
    temperature: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.temperature,
    maxTokens: input.maxTokens ?? EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.maxTokens,
    maxAttempts: input.maxAttempts ?? EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.maxAttempts,
    timeoutMs: input.timeoutMs ?? EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.timeoutMs,
    responseFormat: "json_object",
    thinking: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.thinking,
    signal: input.signal,
    onAttempt: (attempt) => {
      attempts.push(attempt);
    }
  });

  if (!output) {
    return failedGenerativeResult({
      provider,
      attempts,
      promptLineage,
      validationIssues: attemptIssues(attempts),
      fewShotIds: [],
      architecture: "one_call",
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION
    });
  }

  const validationIssues = validateEventCenteredCompleteResponseFirstV12Output({
    generationInput: input,
    output
  });
  if (validationIssues.length > 0) {
    for (let index = attempts.length - 1; index >= 0; index -= 1) {
      const attempt = attempts[index];
      if (!attempt?.success) continue;
      attempts[index] = {
        ...attempt,
        success: false,
        errorCode: "OUTPUT_VALIDATION_FAILED",
        errorMessage: validationIssues.join(";")
      };
      break;
    }
    return failedGenerativeResult({
      provider,
      attempts,
      promptLineage,
      validationIssues,
      fewShotIds: [],
      architecture: "one_call",
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION
    });
  }

  return {
    turn: projectEventCenteredCompleteResponseFirstV12Turn({
      generationInput: input,
      output
    }),
    semanticArtifact: null,
    outputOrigin: "llm",
    attempts,
    promptLineage,
    validationIssues: [],
    qualityDiagnostics: [],
    strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION,
    angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
    fewShotIds: [],
    architecture: "one_call",
    completeResponseText: output.response,
    completeResponseEnvelope: output
  };
}

/** 历史对照与显式 one_call 调用继续复用既有单次组合入口。 */
export async function generateEventCenteredTurnOnceAI(
  input: EventCenteredGenerativeGenerationInput
): Promise<EventCenteredGenerativeGenerationResult> {
  return generateEventCenteredGenerativeTurnAI({ ...input, architecture: "one_call" });
}

function fallbackResponse(input: {
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
  directive: EventCenteredResponseDirective;
}): EventCenteredNaturalResponse {
  const normalizedRawText = normalizeText(input.rawText);
  const rawTextExcerpt = normalizedRawText.length <= 96
    ? normalizedRawText
    : (() => {
        const prefix = normalizedRawText.slice(0, 96);
        const lastBoundary = Math.max(
          prefix.lastIndexOf("。"),
          prefix.lastIndexOf("！"),
          prefix.lastIndexOf("？"),
          prefix.lastIndexOf("；")
        );
        return lastBoundary >= 24
          ? prefix.slice(0, lastBoundary + 1)
          : `${prefix.slice(0, 92).replace(/[，、,:：\s]+$/u, "")}……`;
      })();
  const understanding = input.decision.answerSignal === "unknown"
    ? "你现在还不容易把这部分说清楚。"
    : input.decision.answerSignal === "declined"
      ? "你希望先停在这里，我会按现有内容收住。"
      : input.decision.eventBoundary === "multiple_events"
        ? "这里同时出现了两件值得记录的事。"
        : `我先记住你刚才说的这部分：${rawTextExcerpt}`;
  return {
    naturalUnderstanding: understanding,
    naturalResponse: input.directive.exactResponse,
    hypothesisStatement: input.decision.unsupportedHypothesis?.statement ?? null,
    outcomeStatement: input.decision.outcomeCandidate?.statement ?? null
  };
}

export async function understandEventCenteredTurnAI(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  facts: JournalEventFactRecord[];
  allowUnsupportedHypothesis: boolean;
  /** 离线评测可注入独立 provider；生产省略时继续使用 chat 配置。 */
  provider?: AIProvider | null;
  /** 离线评测可提高结构化输出预算；线上调用继续使用稳定默认值。 */
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<EventCenteredUnderstandingGenerationResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];
  const understandingEnvelope = createPromptEnvelope({
    promptKey: "interview.event_centered.understanding",
    promptVersion: EVENT_CENTERED_UNDERSTANDING_PROMPT_VERSION,
    messages: buildUnderstandingMessages(input)
  });
  const aiDecision = await completeStructuredOutput({
    provider,
    stage: "extract",
    schema: eventCenteredUnderstandingDecisionSchema,
    messages: understandingEnvelope.messages,
    maxTokens: input.maxTokens ?? 1100,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs ?? 12_000,
    signal: input.signal,
    onAttempt: (attempt) => {
      attempts.push(attempt);
    }
  });
  let decision = aiDecision && validateEventCenteredEvidenceQuotes(aiDecision, input.rawText)
    ? aiDecision
    : fallbackDecision(input);
  if (
    aiDecision?.eventBoundary === "multiple_events" ||
    decision.eventBoundary === "multiple_events"
  ) {
    const multipleEventDecision = aiDecision?.eventBoundary === "multiple_events"
      ? aiDecision
      : decision;
    decision = {
      ...decision,
      eventBoundary: "multiple_events",
      coreEventIdentifiable: false,
      answerSignal: "partly_answered",
      facts: [],
      angleEvidence: [],
      outcomeCandidate: null,
      unsupportedHypothesis: null,
      adviceRequest: null,
      eventOptions: resolveEventCenteredFocusOptions({
        rawText: input.rawText,
        suggestedOptions: multipleEventDecision.eventOptions
      }) ?? [],
      correctionTargetHint: null,
      boundaryReason: multipleEventDecision.boundaryReason ??
        "表达中可能包含两件并列事件，需要先确认当前主线。"
    };
  }
  decision = enforceEventCenteredTextBoundaryDecision({
    rawText: input.rawText,
    decision
  });
  if (!input.allowUnsupportedHypothesis && decision.unsupportedHypothesis) {
    decision = { ...decision, unsupportedHypothesis: null };
  }

  return {
    decision,
    outputOrigin: aiDecision ? "llm" : provider ? "fallback" : "deterministic",
    attempts,
    promptLineage: [{
      promptKey: understandingEnvelope.promptKey,
      promptVersion: understandingEnvelope.promptVersion,
      resolvedPromptHash: understandingEnvelope.resolvedPromptHash
    }]
  };
}

export async function realizeEventCenteredTurnAI(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion?: string | null;
  currentQuestionTarget?: string | null;
  decision: EventCenteredUnderstandingDecision;
  directive: EventCenteredResponseDirective;
  /** 离线基线对照可注入同一候选 provider；生产省略时继续读取 chat 配置。 */
  provider?: AIProvider | null;
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<EventCenteredResponseGenerationResult> {
  const provider = input.provider === undefined
    ? await getEventCenteredAIProvider()
    : input.provider;
  const attempts: StructuredOutputAttempt[] = [];

  const responseEnvelope = createPromptEnvelope({
    promptKey: "interview.event_centered.response",
    promptVersion: EVENT_CENTERED_RESPONSE_PROMPT_VERSION,
    messages: buildResponseMessages(input)
  });
  const aiResponse = await completeStructuredOutput({
    provider,
    stage: "question",
    schema: eventCenteredNaturalResponseSchema,
    messages: responseEnvelope.messages,
    maxTokens: input.maxTokens ?? 650,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs ?? 8_000,
    signal: input.signal,
    onAttempt: (attempt) => {
      attempts.push(attempt);
    }
  });
  const alignedResponse = aiResponse &&
    validateEventCenteredHypothesisAlignment({ decision: input.decision, response: aiResponse }) &&
    validateEventCenteredOutcomeAlignment({ decision: input.decision, response: aiResponse }) &&
    validateEventCenteredResponsePresentation({ response: aiResponse, directive: input.directive })
      ? aiResponse
      : fallbackResponse({ rawText: input.rawText, decision: input.decision, directive: input.directive });
  const hypothesisStatement = input.decision.unsupportedHypothesis?.statement ?? null;
  const firstCheckpointPresentation = input.directive.checkpoint?.kind === "first"
      ? getEventCenteredFirstCheckpointPresentation({
          rawText: input.rawText,
          decision: input.decision,
          currentQuestionText: input.currentQuestion,
          currentQuestionTarget: input.currentQuestionTarget
      })
    : null;
  const naturalUnderstanding = resolveEventCenteredNaturalUnderstanding({
    rawText: input.rawText,
    directive: input.directive,
    naturalUnderstanding: alignedResponse.naturalUnderstanding,
    hypothesisStatement,
    firstCheckpointUnderstanding: firstCheckpointPresentation?.understanding ?? null,
    currentQuestionText: input.currentQuestion,
    currentQuestionTarget: input.currentQuestionTarget
  });
  const response = {
    ...alignedResponse,
    naturalUnderstanding,
    naturalResponse: removeRepeatedEventCenteredQuestionAnchor({
      naturalUnderstanding,
      naturalResponse: input.directive.exactResponse,
      anchorText: input.directive.questionSpec?.anchorText
    }),
    hypothesisStatement,
    outcomeStatement: input.directive.angleOutcome?.statement ?? null
  };
  const payload: EventCenteredAssistantPayload = {
    naturalUnderstanding: response.naturalUnderstanding,
    naturalResponse: response.naturalResponse,
    responseKind: input.directive.responseKind,
    questionSpec: input.directive.questionSpec,
    checkpoint: input.directive.checkpoint,
    angleOutcome: input.directive.angleOutcome
  };

  return {
    response,
    payload,
    outputOrigin: aiResponse ? "llm" : provider ? "fallback" : "deterministic",
    attempts,
    promptLineage: [{
      promptKey: responseEnvelope.promptKey,
      promptVersion: responseEnvelope.promptVersion,
      resolvedPromptHash: responseEnvelope.resolvedPromptHash
    }]
  };
}

export async function generateEventCenteredTurnAI(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  facts: JournalEventFactRecord[];
  directive: EventCenteredResponseDirective;
  allowUnsupportedHypothesis: boolean;
  signal?: AbortSignal;
}): Promise<EventCenteredAIGenerationResult> {
  const understanding = await understandEventCenteredTurnAI(input);
  const response = await realizeEventCenteredTurnAI({
    rawText: input.rawText,
    phase: input.phase,
    activeAngle: input.activeAngle,
    currentQuestion: input.currentQuestion,
    decision: understanding.decision,
    directive: input.directive,
    signal: input.signal
  });
  return {
    decision: understanding.decision,
    response: response.response,
    payload: response.payload,
    outputOrigin: understanding.outputOrigin === "llm" && response.outputOrigin === "llm"
      ? "llm"
      : understanding.outputOrigin === "deterministic" && response.outputOrigin === "deterministic"
        ? "deterministic"
        : "fallback",
    attempts: [...understanding.attempts, ...response.attempts],
    promptLineage: [...understanding.promptLineage, ...response.promptLineage]
  };
}

export function isEventCenteredStopExpression(rawText: string) {
  return STOP_PATTERN.test(normalizeText(rawText));
}

export function isEventCenteredUnknownExpression(rawText: string) {
  return isStandaloneUnknownExpression(rawText);
}

export function isBareEventCenteredAngleChange(rawText: string) {
  return /^(换个角度|换一个角度|换角度)[。！!？?]?$/u.test(normalizeText(rawText));
}

export function responseKindAllowsUnsupportedHypothesis(
  phase: EventCenteredDialoguePhase,
  responseKind: EventCenteredResponseKind
) {
  return (phase === "guided_reflection" || phase === "deep_companionship") &&
    responseKind !== "repair" && responseKind !== "checkpoint";
}
