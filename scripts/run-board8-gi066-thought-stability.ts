import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  applyThoughtMapUpdate,
  applyThoughtDeterministicUserSignals,
  createInitialThoughtProtocol,
  type ThoughtDirection,
  type ThoughtProbeOperation,
  type ThoughtProtocolState
} from "@/features/interview/event-centered/thought-judgment-map";
import { decideThoughtQuestionPlan } from "@/features/interview/event-centered/thought-question-policy";
import {
  generateEventCenteredThoughtMapUpdateAI,
  generateEventCenteredThoughtQuestionAI
} from "@/server/services/interview/event-centered-ai.service";
import { preflightEventCenteredCandidateProvider } from "@/server/services/ai/event-centered-provider";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

loadEnvConfig(process.cwd());
process.env.AI_PROVIDER = "openai";
process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com";
process.env.DEEPSEEK_MODEL = "deepseek-v4-flash";
process.env.EVENT_CENTERED_GENERATIVE_MODEL = "deepseek-v4-flash";
process.env.INTERVIEW_EVENT_CENTERED_SCOPE = "thought_only";

const CANDIDATE = {
  strategyVersion: "5.65.0",
  angleCardVersion: "2.18.0",
  fewShotVersion: "quality-patterns.2026-08-04.v35",
  promptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix",
  visiblePromptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix-visible",
  semanticArtifactVersion: "event-centered-semantic-plan.v17",
  dialogueSnapshotVersion: 4
} as const;

type Scenario = {
  id: string;
  label: string;
  rawText: string;
  protocol: () => ThoughtProtocolState;
  facts: Array<[string, string]>;
  expectedAction: "ask" | "transition" | "stop";
  expectedDirection: ThoughtDirection | null;
  expectedClosedDirection?: ThoughtDirection;
  control?: "none" | "continue" | "stop" | "correction";
};

type StabilityResult = {
  scenarioId: string;
  repetition: number;
  expectedAction: Scenario["expectedAction"];
  actualAction: "ask" | "transition" | "stop" | "fail" | null;
  expectedDirection: ThoughtDirection | null;
  actualDirection: ThoughtDirection | null;
  status: "passed" | "failed";
  issues: string[];
  attempts: Array<{
    provider: string;
    success: boolean;
    latencyMs: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  }>;
  operation?: ThoughtProbeOperation | null;
  planHash?: string;
  expressionRepairApplied?: boolean;
};

function answeredProtocol(
  directions: ThoughtDirection[] = ["current_judgment", "judgment_basis"]
) {
  const protocol = createInitialThoughtProtocol();
  for (const direction of directions) {
    protocol.targets[direction] = {
      status: "answered",
      sourceRefs: [`fact:${direction}`],
      relationKey: `relation:${direction}`,
      updatedAtTurnId: "seed"
    };
  }
  return protocol;
}

const scenarios: Scenario[] = [
  {
    id: "D01",
    label: "只有当前判断",
    rawText: "我现在的判断还是先不接这个项目。",
    protocol: () => answeredProtocol(["current_judgment"]),
    facts: [["fact:current_judgment", "用户当前判断为先不接项目"]],
    expectedAction: "ask",
    expectedDirection: "judgment_basis"
  },
  {
    id: "D02",
    label: "只有依据或困扰",
    rawText: "现有两个项目都已经延期，这件事让我很犹豫。",
    protocol: () => answeredProtocol(["judgment_basis"]),
    facts: [["fact:judgment_basis", "现有两个项目已经延期"]],
    expectedAction: "ask",
    expectedDirection: "current_judgment"
  },
  {
    id: "D03",
    label: "基础材料齐全",
    rawText: "我目前仍决定不接，直接依据是它会挤掉已经答应的工作。",
    protocol: () => answeredProtocol(),
    facts: [
      ["fact:current_judgment", "用户当前决定不接新工作"],
      ["fact:judgment_basis", "新工作会挤掉已有承诺"]
    ],
    expectedAction: "ask",
    expectedDirection: "judgment_criterion"
  },
  {
    id: "D04",
    label: "两侧证据并存",
    rawText: "对方已经有明确客户，这支持现在加入；分工和收益还没说清，这又支持继续等。",
    protocol: () => answeredProtocol(),
    facts: [
      ["fact:current_judgment", "用户暂时没有加入合作"],
      ["fact:judgment_basis", "合作同时存在支持加入和支持等待的证据"]
    ],
    expectedAction: "ask",
    expectedDirection: "evidence_tension"
  },
  {
    id: "D05",
    label: "两项目标竞争",
    rawText: "我既想守住已经答应的交付，也想抓住这次扩大决策权的机会。",
    protocol: () => answeredProtocol(),
    facts: [
      ["fact:current_judgment", "用户正在判断是否接下新机会"],
      ["fact:judgment_basis", "已有交付和新机会互相挤压"]
    ],
    expectedAction: "ask",
    expectedDirection: "tradeoff_condition"
  },
  {
    id: "D06",
    label: "明确规则或绝对前提",
    rawText: "只要会影响已经承诺的交付，我就一定不会接新的事情。",
    protocol: () => answeredProtocol(),
    facts: [
      ["fact:current_judgment", "用户决定不接新事情"],
      ["fact:judgment_basis", "用户把已有承诺视为绝对前提"]
    ],
    expectedAction: "ask",
    expectedDirection: "default_assumption"
  },
  {
    id: "D07",
    label: "新证据与判断动摇",
    rawText: "看到同事接手后获得更多决策权，我开始重新考虑之前拒绝的判断。",
    protocol: () => answeredProtocol(),
    facts: [
      ["fact:current_judgment", "用户此前决定拒绝项目"],
      ["fact:judgment_basis", "用户此前依据工作量作出判断"]
    ],
    expectedAction: "ask",
    expectedDirection: "judgment_calibration"
  },
  {
    id: "D08",
    label: "纠正后重规划",
    rawText: "纠正一下，我仍认可拒绝这个决定，只是发现自己低估了决策权的价值。",
    protocol: () => answeredProtocol(),
    facts: [
      ["fact:current_judgment", "旧理解为用户后悔拒绝"],
      ["fact:judgment_basis", "旧判断只考虑工作量"]
    ],
    expectedAction: "ask",
    expectedDirection: "judgment_calibration",
    control: "correction"
  },
  {
    id: "D09",
    label: "第二次说不清关闭当前方向",
    rawText: "我还是说不清这个标准。",
    protocol: () => {
      const protocol = answeredProtocol();
      protocol.targets.judgment_criterion.status = "unclear";
      protocol.currentDirection = "judgment_criterion";
      protocol.directionQuestionCount = 1;
      protocol.lowPressureRetryUsedDirections = ["judgment_criterion"];
      return protocol;
    },
    facts: [
      ["fact:current_judgment", "用户暂时不接项目"],
      ["fact:judgment_basis", "项目会影响已有交付"]
    ],
    expectedAction: "transition",
    expectedDirection: null,
    expectedClosedDirection: "judgment_criterion"
  },
  {
    id: "D10",
    label: "停止立即生效",
    rawText: "先停在这里，不要再问了。",
    protocol: () => {
      const protocol = answeredProtocol();
      Object.values(protocol.targets).forEach((target) => {
        target.status = "closed";
      });
      return protocol;
    },
    facts: [
      ["fact:current_judgment", "用户已有当前判断"],
      ["fact:judgment_basis", "用户已有判断依据"]
    ],
    expectedAction: "stop",
    expectedDirection: null,
    control: "stop"
  }
];

function fact(id: string, statement: string): JournalEventFactRecord {
  return {
    id,
    eventId: "gi066-stability",
    createdBranchSessionId: "gi066-stability",
    pathAnchorMessageId: `message:${id}`,
    createdByRevisionId: null,
    statement,
    scope: "current_event",
    stance: "affirmed",
    kind: "stated_interpretation",
    origin: "user_expression",
    createdAt: "2026-08-04T00:00:00.000Z",
    evidence: [{
      id: `evidence:${id}`,
      factId: id,
      sourceTurnId: `turn:${id}`,
      contextMessageId: null,
      pathAnchorMessageId: `message:${id}`,
      role: "direct_expression",
      quote: statement,
      createdAt: "2026-08-04T00:00:00.000Z"
    }]
  };
}

function expressionIssues(summary: string, question: string, sourceTexts: string[]) {
  const issues: string[] = [];
  if (!summary.trim() || !question.trim().endsWith("？")) issues.push("invalid_visible_structure");
  if (/^(?:你提到|你说|刚才你)/u.test(summary.trim())) issues.push("user_restatement");
  if (/(?:^|[，。；：])我(?:觉得|认为|想|担心|希望|决定|判断)/u.test(`${summary}。${question}`)) {
    issues.push("first_person_impersonation");
  }
  if (sourceTexts.some((text) => text.length >= 8 && summary.includes(text))) {
    issues.push("verbatim_source_repetition");
  }
  return issues;
}

const startedAt = new Date().toISOString();
const preflight = await preflightEventCenteredCandidateProvider();
if (!preflight.reachable) throw new Error("GI066_DEEPSEEK_PREFLIGHT_FAILED");

const results: StabilityResult[] = [];
const onlyScenario = process.argv.find((argument) => argument.startsWith("--only-scenario="))
  ?.split("=")[1];
const selectedScenarios = onlyScenario
  ? scenarios.filter((scenario) => scenario.id === onlyScenario)
  : scenarios;
const repetitionCount = onlyScenario ? 1 : 3;
for (const scenario of selectedScenarios) {
  for (let repetition = 1; repetition <= repetitionCount; repetition += 1) {
    const protocol = scenario.protocol();
    const facts = scenario.facts.map(([id, statement]) => fact(id, statement));
    const mapResult = await generateEventCenteredThoughtMapUpdateAI({
      rawText: scenario.rawText,
      protocol,
      facts,
      recentTurns: [],
      correctionRequested: scenario.control === "correction"
    });
    const issues = [...mapResult.validationIssues];
    if (!mapResult.update) {
      results.push({
        scenarioId: scenario.id,
        repetition,
        expectedAction: scenario.expectedAction,
        actualAction: null,
        expectedDirection: scenario.expectedDirection,
        actualDirection: null,
        status: "failed",
        issues,
        attempts: mapResult.attempts.map((attempt) => ({
          provider: attempt.provider,
          success: attempt.success,
          latencyMs: attempt.latencyMs,
          errorCode: attempt.errorCode,
          errorMessage: attempt.errorMessage ?? null
        }))
      });
      continue;
    }
    const updated = applyThoughtDeterministicUserSignals({
      rawText: scenario.rawText,
      sourceRef: `turn:${scenario.id}:${repetition}:1`,
      protocol: applyThoughtMapUpdate({
      protocol,
      update: mapResult.update,
      turnId: `${scenario.id}:${repetition}`
      })
    });
    const routed = decideThoughtQuestionPlan({
      protocol: updated,
      control: scenario.control ?? "none"
    });
    const sourceEvidence = [
      ...facts.map((item) => ({ ref: item.id, sourceText: item.statement })),
      ...mapResult.update.factDeltas.map((item, index) => ({
        ref: `new:${index + 1}`,
        sourceText: item.quote
      }))
    ];
    const expression = routed.plan.action === "ask"
      ? await generateEventCenteredThoughtQuestionAI({
          plan: routed.plan,
          sourceEvidence,
          correctionRequested: scenario.control === "correction"
        })
      : null;
    if (routed.plan.action === "ask" && !expression?.expression) {
      issues.push(...(expression?.validationIssues ?? ["missing_expression"]));
    }
    if (expression?.expression) {
      issues.push(...expressionIssues(
        expression.expression.thinkingSummary,
        expression.expression.question,
        sourceEvidence.map((item) => item.sourceText)
      ));
    }
    if (routed.plan.action !== scenario.expectedAction) issues.push("action_mismatch");
    if (routed.plan.direction !== scenario.expectedDirection) issues.push("direction_mismatch");
    if (
      scenario.expectedClosedDirection &&
      routed.protocol.targets[scenario.expectedClosedDirection].status !== "closed"
    ) issues.push("target_not_closed");
    const allAttempts = [...mapResult.attempts, ...(expression?.attempts ?? [])];
    if (allAttempts.some((attempt) => /ark|volcengine/iu.test(attempt.provider))) {
      issues.push("ark_trace_detected");
    }
    results.push({
      scenarioId: scenario.id,
      repetition,
      expectedAction: scenario.expectedAction,
      actualAction: routed.plan.action,
      expectedDirection: scenario.expectedDirection,
      actualDirection: routed.plan.direction,
      operation: routed.plan.operation,
      planHash: routed.plan.planHash,
      expressionRepairApplied: expression?.repaired ?? false,
      status: issues.length === 0 ? "passed" : "failed",
      issues: [...new Set(issues)],
      attempts: allAttempts.map((attempt) => ({
        provider: attempt.provider,
        success: attempt.success,
        latencyMs: attempt.latencyMs,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage ?? null
      }))
    });
  }
}

const passedCount = results.filter((result) => result.status === "passed").length;
const actionCorrectCount = results.filter((result) =>
  result.actualAction === result.expectedAction
).length;
const directionCorrectCount = results.filter((result) =>
  result.actualDirection === result.expectedDirection
).length;
const repeatedDirectionMismatchScenarios = scenarios.flatMap((scenario) => {
  const mismatchCount = results.filter((result) =>
    result.scenarioId === scenario.id && result.issues.includes("direction_mismatch")
  ).length;
  return mismatchCount >= 2 ? [{ scenarioId: scenario.id, mismatchCount }] : [];
});
const issueDistribution = Object.entries(results.flatMap((result) => result.issues).reduce(
  (counts, issue) => ({ ...counts, [issue]: (counts[issue] ?? 0) + 1 }),
  {} as Record<string, number>
));
const expectedTotal = selectedScenarios.length * repetitionCount;
const passed = actionCorrectCount === expectedTotal &&
  directionCorrectCount >= Math.ceil(expectedTotal * 0.9) &&
  repeatedDirectionMismatchScenarios.length === 0 &&
  results.every((result) => !result.issues.some((issue) => [
    "ark_trace_detected",
    "user_restatement",
    "first_person_impersonation",
    "verbatim_source_repetition"
  ].includes(issue)));
const completedAt = new Date().toISOString();
const evidence = {
  evaluation: "GI-066 10×3 判断地图稳定性小门",
  candidate: CANDIDATE,
  provider: preflight,
  startedAt,
  completedAt,
  summary: {
    total: results.length,
    passedCount,
    actionCorrectCount,
    directionCorrectCount,
    repeatedDirectionMismatchScenarios,
    issueDistribution: Object.fromEntries(issueDistribution),
    verdict: passed ? "pass" : "fail"
  },
  results
};
const outputDirectory = resolve(
  process.cwd(),
  "artifacts/generative-interview-board8/2026-08-04-gi066-fix-thought-stability"
);
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(resolve(outputDirectory, "report.md"), [
  "# GI-066｜10×3 判断地图稳定性小门",
  "",
  `- 裁决：${passed ? "通过" : "失败"}`,
  `- 动作正确：${actionCorrectCount}/30`,
  `- 方向正确：${directionCorrectCount}/30`,
  `- 完整无问题：${passedCount}/30`,
  `- 重复选题错误：${repeatedDirectionMismatchScenarios.length === 0 ? "0" : repeatedDirectionMismatchScenarios.map((item) => `${item.scenarioId}×${item.mismatchCount}`).join("、")}`,
  `- Provider：${preflight.provider} · ${preflight.baseUrlHost} · ${preflight.model}`,
  `- 预检耗时：${preflight.latencyMs}ms`,
  "",
  "| 场景 | 重复 | 动作 | 方向 | 裁决 | 问题码 |",
  "|---|---:|---|---|---|---|",
  ...results.map((result) =>
    `| ${result.scenarioId} | ${result.repetition} | ${result.actualAction ?? "-"} | ${result.actualDirection ?? "-"} | ${result.status} | ${result.issues.join("、") || "-"} |`
  )
].join("\n"));

process.stdout.write(`${JSON.stringify({
  verdict: evidence.summary.verdict,
  actionCorrectCount,
  directionCorrectCount,
  passedCount,
  outputDirectory
}, null, 2)}\n`);
if (!passed) process.exitCode = 1;
