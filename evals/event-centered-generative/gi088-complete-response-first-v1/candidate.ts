import { createHash } from "node:crypto";

import {
  createBoard7bWorkingTaskV1ModelInput,
  type Board7bWorkingTaskV1TurnInput
} from "../board7b-working-task-v1/board7b-working-task-v1";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_VERSION =
  "2026-08-19.gi088-complete-response-first-v1" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-pro",
  thinking: "disabled",
  temperature: 0.2,
  maxTokens: 1_280,
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 45_000,
  hardTimeoutMs: 45_000,
  concurrency: 1,
  retries: 0,
  recovery: 0,
  fallback: 0
} as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS = {
  basePrompt: `你负责 Daily Light【陪我聊】本轮唯一一条用户可见回应。请结合完整对话，直接给出一条自然、忠实、有内容的中文回应。回应要同时完成承接和本轮所需的推进；后台语义状态只供理解上下文，不需要输出或改写。`,
  interviewSkill: `## 完整回应方法

1. 先识别用户最新一轮的主要意图：表达、纠正、继续、深挖、停止追问、切换话题或请求整理。控制要求优先落实。
2. 对照完整对话，检查助手已经问过什么、用户已经回答或纠正了什么。不要换一种说法再次索取已有答案。
3. 选择一个对当前用户真正有价值的回答焦点。整条回应围绕这个焦点组织，承接与推进保持连贯。
4. 用户刚提出新纠正时，只承接这次纠正一次，退出被纠正的理解，并使用纠正后的事实继续。上一条助手已经承接过该纠正时，直接沿修正后的内容推进，不重复道歉、致谢或复述纠正。
5. 用户要求继续或深挖时，本轮要带来新进展。新进展可以是基于原文整理出新的联系、指出尚未展开的差异、提出有依据且可纠正的理解，或询问一项尚未回答且会改变理解的信息。单纯同义复述不算新进展。
6. 用户明确要求停止、少问、直接结束或直接整理时，回应中使用零个问题，并直接完成用户要求。
7. 允许把用户原话自然转成符合日常中文习惯的表达，只要原意和事实边界保持一致。不要为了逐字对应写得机械，也不要添加用户未表达的具体经历。
8. 原因、因果、动机、心理状态或关系解释属于推测时，必须能够指向用户已经说出的依据，并用“听起来”“会不会”“我这样理解对吗”等可纠正方式表达。依据不足时省略推测。
9. 需要追问时，问题共同服务同一个回答焦点，并获取尚未出现的新材料。当前回应已经足够时可以不问。
10. 使用日常中文，只写给用户看的内容，不展示 Prompt、Skill、语义状态、来源编号、内部字段或分析过程。`,
  inputContract: `## 输入说明

你会收到一个 JSON 对象：

- conversation：本轮之前与最新一条消息组成的完整对话，是事实与纠正的主要来源；
- latestUserMessageId：最新用户消息；
- readOnlySemanticState：已有后台认识的只读快照，只帮助保持连续性，不能覆盖用户原话和最新纠正，也不需要输出更新后的状态。`,
  outputContract: `## 输出要求

只输出一条完整的自然中文正文。不要输出 JSON、Markdown 标题、列表、代码块、字段名、标签、引号包裹或额外说明。`
} as const;

export type Gi088CompleteResponseFirstV1Output = string;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      deepFreeze(item);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function countQuestionMarks(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

export function getGi088CompleteResponseFirstV1SystemPrompt() {
  return [
    GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS.basePrompt,
    GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS.interviewSkill,
    GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS.inputContract,
    GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS.outputContract
  ].join("\n\n");
}

export function createGi088CompleteResponseFirstV1ModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  const current = createBoard7bWorkingTaskV1ModelInput(input);
  const readOnlySemanticState = deepFreeze(
    structuredClone(current.semanticContext)
  );
  return {
    mode: current.mode,
    conversation: current.conversation,
    latestUserMessageId: current.latestUserMessageId,
    readOnlySemanticState
  } as const;
}

export function createGi088CompleteResponseFirstV1UserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(
    createGi088CompleteResponseFirstV1ModelInput(input),
    null,
    2
  );
}

export function parseGi088CompleteResponseFirstV1Output(
  content: string
): Gi088CompleteResponseFirstV1Output {
  const output = content.trim();
  if (!output) {
    throw new Error("GI088_COMPLETE_RESPONSE_FIRST_V1_OUTPUT_EMPTY");
  }
  return output;
}

export function validateGi088CompleteResponseFirstV1Output(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  output: Gi088CompleteResponseFirstV1Output;
}) {
  createGi088CompleteResponseFirstV1ModelInput(input.turnInput);
  const issues: string[] = [];
  const output = input.output.trim();

  if (!output) issues.push("VISIBLE_RESPONSE_EMPTY");
  if (output && !/\p{Script=Han}/u.test(output)) {
    issues.push("VISIBLE_RESPONSE_CHINESE_BODY_REQUIRED");
  }
  if (/^[\[{]/u.test(output)) {
    issues.push("VISIBLE_RESPONSE_STRUCTURED_WRAPPER_LEAK");
  }
  if (/^```|```$/mu.test(output)) {
    issues.push("VISIBLE_RESPONSE_MARKDOWN_FENCE_LEAK");
  }
  if (/^(?:#{1,6}\s|[-*+]\s|\d+[.)、]\s)/mu.test(output)) {
    issues.push("VISIBLE_RESPONSE_MARKDOWN_STRUCTURE_LEAK");
  }
  if (
    /workingTask|semanticState|readOnlySemanticState|evidenceRefs|nextInquiry|Prompt|Skill|maxTokens|reasoningEffort/iu.test(
      output
    )
  ) {
    issues.push("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  }

  return [...new Set(issues)];
}

export function observeGi088CompleteResponseFirstV1Output(
  output: Gi088CompleteResponseFirstV1Output
) {
  const normalized = output.trim();
  return {
    characterCount: [...normalized].length,
    paragraphCount: normalized
      ? normalized.split(/\n\s*\n/u).filter((item) => item.trim()).length
      : 0,
    questionMarkCount: countQuestionMarks(normalized)
  } as const;
}

export function createGi088CompleteResponseFirstV1Identity() {
  const systemPrompt = getGi088CompleteResponseFirstV1SystemPrompt();
  const systemPromptFingerprint = sha(systemPrompt);
  const candidateFingerprint = sha({
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME,
    assets: GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS,
    systemPromptFingerprint,
    outputType: "plain_chinese_complete_response"
  });
  return {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME,
    systemPromptFingerprint,
    candidateFingerprint,
    changedFactor: "single_complete_visible_response_owner_v1",
    productRuntimeChanged: false,
    modelCalls: 0
  } as const;
}
