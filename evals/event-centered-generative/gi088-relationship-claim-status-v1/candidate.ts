import { createHash } from "node:crypto";

import { z } from "zod";

import {
  createBoard7bWorkingTaskV1CandidateFingerprint,
  type Board7bWorkingTaskV1Assets
} from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088EventRelationshipExplanationCandidateFingerprint,
  getGi088EventRelationshipExplanationCandidateAssets
} from "../gi088-event-relationship-explanation-v1/candidate";
import {
  gi088SemanticDeltaOutputSchema,
  type Gi088SemanticDeltaOutput
} from "../../../src/server/services/evaluation/gi088/semantic-delta";

export const GI088_RELATIONSHIP_CLAIM_STATUS_CANDIDATE_VERSION =
  "2026-08-16.gi088-relationship-claim-status-v1" as const;

export const GI088_RELATIONSHIP_CLAIM_STATUS_RULES = [
  "DECLARE_EVERY_RELATIONSHIP_EXPLANATION_USED_IN_OUTPUT",
  "USER_STATED_CLAIM_REQUIRES_USER_MESSAGE_EVIDENCE",
  "HYPOTHESIS_TO_CONFIRM_HAS_NO_ESTABLISHED_EVIDENCE",
  "HYPOTHESIS_TO_CONFIRM_ONLY_ENTERS_NEXT_INQUIRY_AND_VISIBLE_RESPONSE",
  "ESTABLISHED_STATE_ONLY_USES_USER_STATED_RELATIONSHIP_CLAIMS",
  "PROGRAM_VALIDATES_CLAIM_ID_STATUS_AND_USAGE_DESTINATION"
] as const;

export const GI088_RELATIONSHIP_CLAIM_STATUS_APPENDICES = {
  basePrompt: `## 关系解释状态

凡是本轮输出使用了事件比较、具体原因、因果、心理状态、动机或人际关系解释，都先登记为一条关系解释：

- \`user_stated\`：用户已经明确说出或确认；必须引用能够支持这条解释的用户消息。
- \`hypothesis_to_confirm\`：模型为了继续理解而提出的待确认假设；没有已成立证据，只能出现在下一问和提问式可见回应中。

普通事件事实不需要登记。关系解释必须逐条登记，不能把宽泛对比和具体原因合并为一条。`,
  interviewSkill: `## 关系解释清单与使用位置

输出前完成以下检查：

1. 找出准备写入 \`workingTask\`、\`understandingChange\`、\`nextInquiry\`、可见理解和可见回应的所有关系解释。
2. 用户原话已经明确支持的解释标为 \`user_stated\`，引用对应用户消息。
3. 需要用户确认的具体原因、因果、心理状态、动机或关系含义标为 \`hypothesis_to_confirm\`，\`evidenceRefs\` 保持空数组。
4. \`hypothesis_to_confirm\` 只允许被 \`nextInquiry\` 和 \`visibleResponse\` 使用；提问必须让用户可以纠正或否定。
5. \`workingTask\`、\`understandingChange\` 和 \`visibleUnderstanding\` 只能使用 \`user_stated\`。
6. 用户明确说明两件事无关时，“两件事无关”可以作为 \`user_stated\` 关系继承。

例：用户只说“外面好玩，回家后又要做事”，可以登记“外面和回家体验不同”为 \`user_stated\`；“外面更轻松是因为回家会被支使”属于 \`hypothesis_to_confirm\`，只能放进问题。`,
  outputContract: `## 关系解释状态字段

\`semantic.relationshipClaims\` 中每项只能使用以下一种：

- \`{ "claimId": "RC1", "status": "user_stated", "summary": "用户已明确的关系解释", "evidenceRefs": ["用户消息 id"] }\`
- \`{ "claimId": "RC2", "status": "hypothesis_to_confirm", "summary": "等待用户确认的关系解释", "evidenceRefs": [] }\`

\`semantic.relationshipClaimUsage\` 必须完整列出每条解释出现的位置：

\`workingTask / understandingChange / nextInquiry / visibleUnderstanding / visibleResponse\`。

硬约束：

- 关系解释已在输出中出现时，必须登记并在对应位置引用；没有关系解释时，清单和五个位置都使用空数组。
- \`hypothesis_to_confirm\` 只能被 \`nextInquiry\` 和 \`visibleResponse\` 引用，并且两处都要引用。
- \`user_stated\` 的 \`evidenceRefs\` 至少一条；\`hypothesis_to_confirm\` 的 \`evidenceRefs\` 必须为空。
- 程序会校验解释编号、来源、状态与使用位置；违反使用范围时整条结果无效。`
} as const;

const strictString = z.string().trim().min(1);
const claimIdSchema = strictString.max(80);
const userStatedClaimSchema = z
  .object({
    claimId: claimIdSchema,
    status: z.literal("user_stated"),
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const hypothesisClaimSchema = z
  .object({
    claimId: claimIdSchema,
    status: z.literal("hypothesis_to_confirm"),
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).max(0)
  })
  .strict();
const relationshipClaimSchema = z.discriminatedUnion("status", [
  userStatedClaimSchema,
  hypothesisClaimSchema
]);
const claimUsageSchema = z
  .object({
    workingTask: z.array(claimIdSchema).max(30),
    understandingChange: z.array(claimIdSchema).max(30),
    nextInquiry: z.array(claimIdSchema).max(30),
    visibleUnderstanding: z.array(claimIdSchema).max(30),
    visibleResponse: z.array(claimIdSchema).max(30)
  })
  .strict();

export const gi088RelationshipClaimStatusOutputSchema =
  gi088SemanticDeltaOutputSchema
    .extend({
      semantic: gi088SemanticDeltaOutputSchema.shape.semantic
        .extend({
          relationshipClaims: z.array(relationshipClaimSchema).max(30),
          relationshipClaimUsage: claimUsageSchema
        })
        .strict()
    })
    .strict();

export type Gi088RelationshipClaimStatusOutput = z.infer<
  typeof gi088RelationshipClaimStatusOutputSchema
>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

function addRelationshipClaimFields(outputContract: string) {
  const marker = '    "pauseReason": null\n  },';
  if (!outputContract.includes(marker)) {
    throw new Error("GI088_RELATIONSHIP_CLAIM_STATUS_CONTRACT_MARKER_MISSING");
  }
  return outputContract.replace(
    marker,
    `    "pauseReason": null,
    "relationshipClaims": [],
    "relationshipClaimUsage": {
      "workingTask": [],
      "understandingChange": [],
      "nextInquiry": [],
      "visibleUnderstanding": [],
      "visibleResponse": []
    }
  },`
  );
}

export function applyGi088RelationshipClaimStatusAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const basePrompt = appendSection(
    assets.basePrompt,
    GI088_RELATIONSHIP_CLAIM_STATUS_APPENDICES.basePrompt
  );
  const interviewSkillSource = appendSection(
    assets.interviewSkillSource,
    GI088_RELATIONSHIP_CLAIM_STATUS_APPENDICES.interviewSkill
  );
  const interviewSkill = appendSection(
    assets.interviewSkill,
    GI088_RELATIONSHIP_CLAIM_STATUS_APPENDICES.interviewSkill
  );
  const outputContract = appendSection(
    addRelationshipClaimFields(assets.outputContract),
    GI088_RELATIONSHIP_CLAIM_STATUS_APPENDICES.outputContract
  );
  return {
    ...assets,
    basePrompt,
    interviewSkillSource,
    interviewSkill,
    outputContract,
    systemPrompt: [basePrompt, interviewSkill, outputContract].join("\n\n")
  };
}

export function getGi088RelationshipClaimStatusCandidateAssets() {
  return applyGi088RelationshipClaimStatusAssets(
    getGi088EventRelationshipExplanationCandidateAssets()
  );
}

export function parseGi088RelationshipClaimStatusOutput(content: string) {
  return gi088RelationshipClaimStatusOutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

export function toGi088SemanticDeltaOutput(
  output: Gi088RelationshipClaimStatusOutput
): Gi088SemanticDeltaOutput {
  const semantic: Record<string, unknown> = { ...output.semantic };
  delete semantic.relationshipClaims;
  delete semantic.relationshipClaimUsage;
  return gi088SemanticDeltaOutputSchema.parse({
    semantic,
    visible: output.visible
  });
}

export function validateGi088RelationshipClaimStatusOutput(input: {
  output: Gi088RelationshipClaimStatusOutput;
  userMessageIds: Set<string>;
}) {
  const issues: string[] = [];
  const claims = input.output.semantic.relationshipClaims;
  const usage = input.output.semantic.relationshipClaimUsage;
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  if (claimById.size !== claims.length) {
    issues.push("RELATIONSHIP_CLAIM_ID_DUPLICATE");
  }

  for (const claim of claims) {
    for (const evidenceRef of claim.evidenceRefs) {
      if (!input.userMessageIds.has(evidenceRef)) {
        issues.push(`RELATIONSHIP_CLAIM_UNKNOWN_USER_EVIDENCE:${claim.claimId}:${evidenceRef}`);
      }
    }
  }

  const usageEntries = Object.entries(usage) as Array<
    [keyof typeof usage, string[]]
  >;
  const usedClaimIds = new Set<string>();
  for (const [destination, claimIds] of usageEntries) {
    for (const claimId of claimIds) {
      usedClaimIds.add(claimId);
      const claim = claimById.get(claimId);
      if (!claim) {
        issues.push(`RELATIONSHIP_CLAIM_USAGE_UNKNOWN:${destination}:${claimId}`);
        continue;
      }
      if (
        claim.status === "hypothesis_to_confirm" &&
        destination !== "nextInquiry" &&
        destination !== "visibleResponse"
      ) {
        issues.push(`RELATIONSHIP_HYPOTHESIS_USED_AS_ESTABLISHED:${destination}:${claimId}`);
      }
    }
  }

  for (const claim of claims) {
    if (!usedClaimIds.has(claim.claimId)) {
      issues.push(`RELATIONSHIP_CLAIM_UNUSED:${claim.claimId}`);
    }
    if (claim.status === "hypothesis_to_confirm") {
      if (!usage.nextInquiry.includes(claim.claimId)) {
        issues.push(`RELATIONSHIP_HYPOTHESIS_MISSING_NEXT_INQUIRY_USAGE:${claim.claimId}`);
      }
      if (!usage.visibleResponse.includes(claim.claimId)) {
        issues.push(`RELATIONSHIP_HYPOTHESIS_MISSING_VISIBLE_RESPONSE_USAGE:${claim.claimId}`);
      }
    }
  }

  const semantic = input.output.semantic;
  if (usage.workingTask.length && !semantic.workingTask) {
    issues.push("RELATIONSHIP_WORKING_TASK_USAGE_WITHOUT_WORKING_TASK");
  }
  if (
    usage.understandingChange.length &&
    semantic.understandingChange.kind === "none"
  ) {
    issues.push("RELATIONSHIP_UNDERSTANDING_USAGE_WITHOUT_CHANGE");
  }
  if (usage.nextInquiry.length && !semantic.nextInquiry) {
    issues.push("RELATIONSHIP_NEXT_INQUIRY_USAGE_WITHOUT_NEXT_INQUIRY");
  }
  if (usage.visibleUnderstanding.length && !input.output.visible.understanding) {
    issues.push("RELATIONSHIP_VISIBLE_UNDERSTANDING_USAGE_WITHOUT_TEXT");
  }
  if (
    claims.some((claim) => claim.status === "hypothesis_to_confirm") &&
    semantic.action !== "ask"
  ) {
    issues.push("RELATIONSHIP_HYPOTHESIS_REQUIRES_ASK_ACTION");
  }

  return [...new Set(issues)];
}

export function createGi088RelationshipClaimStatusPolicyFingerprint() {
  return sha({
    version: GI088_RELATIONSHIP_CLAIM_STATUS_CANDIDATE_VERSION,
    rules: GI088_RELATIONSHIP_CLAIM_STATUS_RULES,
    appendices: GI088_RELATIONSHIP_CLAIM_STATUS_APPENDICES
  });
}

export function createGi088RelationshipClaimStatusCandidateFingerprint() {
  const assets = getGi088RelationshipClaimStatusCandidateAssets();
  return sha({
    version: GI088_RELATIONSHIP_CLAIM_STATUS_CANDIDATE_VERSION,
    parentCandidateFingerprint:
      createGi088EventRelationshipExplanationCandidateFingerprint(),
    policyFingerprint: createGi088RelationshipClaimStatusPolicyFingerprint(),
    assetFingerprint: createBoard7bWorkingTaskV1CandidateFingerprint(assets)
  });
}

export function createGi088RelationshipClaimStatusCandidateIdentity() {
  return {
    version: GI088_RELATIONSHIP_CLAIM_STATUS_CANDIDATE_VERSION,
    parentCandidateFingerprint:
      createGi088EventRelationshipExplanationCandidateFingerprint(),
    policyFingerprint: createGi088RelationshipClaimStatusPolicyFingerprint(),
    candidateFingerprint: createGi088RelationshipClaimStatusCandidateFingerprint(),
    productRuntimeChanged: false,
    changedFactor: "relationship_claim_status_v1"
  } as const;
}
