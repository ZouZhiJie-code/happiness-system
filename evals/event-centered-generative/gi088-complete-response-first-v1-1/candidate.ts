import { createHash } from "node:crypto";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS,
  GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME,
  createGi088CompleteResponseFirstV1ModelInput,
  observeGi088CompleteResponseFirstV1Output,
  parseGi088CompleteResponseFirstV1Output,
  validateGi088CompleteResponseFirstV1Output,
  type Gi088CompleteResponseFirstV1Output
} from "../gi088-complete-response-first-v1/candidate";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION =
  "2026-08-19.gi088-complete-response-first-v1-1-new-information-target" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME =
  GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS = {
  ...GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS,
  interviewSkill: `## 完整回应方法

1. 先识别用户最新一轮的主要意图：表达、纠正、继续、深挖、停止追问、切换话题或请求整理。控制要求优先落实。
2. 对照完整对话，检查助手已经问过什么、用户原文已经完整回答什么、仍有哪些内容尚未展开。不要换一种说法再次索取已有答案。
3. 写回应前，先在内部选择一个“本轮新增信息目标”。它必须是完整原文尚未回答、继续了解后会带来实际新进展的一件事。整条回应只围绕这个目标组织，不输出目标名称和分析过程。
4. 用户明确要求停止、少问、直接结束或直接整理时，直接收束并完成用户要求，使用零个问题，也不再选择需要用户补充的信息目标。
5. 用户表达疲惫、为难、压力或不想多说等负担，但没有要求停止时，先降低回应负担，再给一个容易接住的继续入口。允许用户简短回答、稍后再说或顺着自己的方式继续，不用连续追问。
6. 用户要求继续或深挖时，本轮必须进入一个新的层次：可以追到尚未展开的具体情境、变化、影响、关系或意义，也可以提出一处有原文依据且可纠正的新理解。不要让用户确认刚刚已经明确说完的结论，也不要同义复述后原地追问。
7. 用户刚提出新纠正时，只承接这次纠正一次，退出被纠正的理解，并从纠正后的事实走向新增信息目标。上一条助手已经承接过该纠正时，直接沿修正后的内容推进，不重复道歉、致谢或纠正内容。
8. 每轮最多表达一处可纠正的解释，并最多提出一个主问题。解释涉及原因、因果、动机、心理状态或关系时，必须能指向用户原文，并用自然的可纠正方式表达；依据不足时省略解释。
9. 主问题只获取新增信息目标对应的新材料。不要列出用户已经回答过的具体选项，也不要把一个主问题拆成多个并列问题。回应已经足够或用户只需要被接住时，可以不问。
10. 允许把用户原话自然转成符合日常中文习惯的表达，只要原意和事实边界保持一致。不要为了逐字对应写得机械，也不要添加用户未表达的具体经历。
11. 使用日常中文，写成一至两个短段落。只写给用户看的完整回应，不展示 Prompt、Skill、语义状态、来源编号、内部字段、新增信息目标或分析过程。`
} as const;

export type Gi088CompleteResponseFirstV11Output =
  Gi088CompleteResponseFirstV1Output;

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

export function getGi088CompleteResponseFirstV11SystemPrompt() {
  return [
    GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.basePrompt,
    GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.interviewSkill,
    GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.inputContract,
    GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.outputContract
  ].join("\n\n");
}

export function createGi088CompleteResponseFirstV11ModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  return createGi088CompleteResponseFirstV1ModelInput(input);
}

export function createGi088CompleteResponseFirstV11UserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(
    createGi088CompleteResponseFirstV11ModelInput(input),
    null,
    2
  );
}

export function parseGi088CompleteResponseFirstV11Output(
  content: string
): Gi088CompleteResponseFirstV11Output {
  return parseGi088CompleteResponseFirstV1Output(content);
}

export function validateGi088CompleteResponseFirstV11Output(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  output: Gi088CompleteResponseFirstV11Output;
}) {
  return validateGi088CompleteResponseFirstV1Output(input);
}

export function observeGi088CompleteResponseFirstV11Output(
  output: Gi088CompleteResponseFirstV11Output
) {
  return observeGi088CompleteResponseFirstV1Output(output);
}

export function createGi088CompleteResponseFirstV11Identity() {
  const systemPrompt = getGi088CompleteResponseFirstV11SystemPrompt();
  const systemPromptFingerprint = sha(systemPrompt);
  const candidateFingerprint = sha({
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
    assets: GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS,
    systemPromptFingerprint,
    outputType: "plain_chinese_complete_response"
  });
  return {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
    systemPromptFingerprint,
    candidateFingerprint,
    changedFactor: "select_one_unanswered_new_information_target_before_output",
    productRuntimeChanged: false,
    modelCalls: 0
  } as const;
}
