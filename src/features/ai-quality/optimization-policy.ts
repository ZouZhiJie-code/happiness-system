import type { AIGenerationArtifactType, AIOptimizationPath, InterviewDimension } from "@prisma/client";

export type OptimizationEvidence = {
  traceId: string;
  artifactType: AIGenerationArtifactType;
  dimension: InterviewDimension | null;
  issueCode: string;
  summary: string | null;
  priority: number;
};

export type BadcaseCluster = {
  artifactType: AIGenerationArtifactType;
  dimension: InterviewDimension | null;
  issueCode: string;
  traceIds: string[];
  caseCount: number;
  summary: string;
  suggestedPath: AIOptimizationPath;
  maxPriority: number;
};

const ENGINEERING_ISSUE_PATTERN =
  /(invalid_.*payload|schema|provider|generation_not_completed|missing_final_output|database|trace|request_log)/iu;

export function chooseOptimizationPath(issueCode: string): AIOptimizationPath {
  return ENGINEERING_ISSUE_PATTERN.test(issueCode) ? "engineering" : "system_prompt";
}

export function getPromptKeyForArtifact(
  artifactType: AIGenerationArtifactType,
  dimension: InterviewDimension | null
) {
  if (!dimension) return null;
  return artifactType === "dimension_journal"
    ? `interview.journal.${dimension}`
    : `interview.question.${dimension}`;
}

export function clusterBadcases(evidence: OptimizationEvidence[]): BadcaseCluster[] {
  const groups = new Map<string, OptimizationEvidence[]>();

  for (const item of evidence) {
    const key = `${item.artifactType}:${item.dimension ?? "unknown"}:${item.issueCode}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return Array.from(groups.values())
    .map((items) => {
      const first = items[0];
      const suggestedPath = chooseOptimizationPath(first.issueCode);
      return {
        artifactType: first.artifactType,
        dimension: first.dimension,
        issueCode: first.issueCode,
        traceIds: items.map((item) => item.traceId),
        caseCount: items.length,
        summary: `${items.length} 条${first.dimension ?? "未分类"}生成命中 ${first.issueCode}。`,
        suggestedPath,
        maxPriority: Math.max(...items.map((item) => item.priority))
      };
    })
    .sort((left, right) => right.maxPriority - left.maxPriority || right.caseCount - left.caseCount);
}

export function buildOptimizationProposal(cluster: BadcaseCluster) {
  if (cluster.suggestedPath === "engineering") {
    return {
      title: `工程修复：${cluster.issueCode}`,
      rationale: `${cluster.summary} 该模式涉及结构、Schema、运行时或血缘完整性，需要工程修复与回归测试。`,
      proposal: {
        workItemType: "rule_or_schema",
        issueCode: cluster.issueCode,
        acceptanceCriteria: [
          "补充可复现的自动化 Badcase 测试",
          "修复结构或确定性规则并通过全量回归",
          "发布后观察同类问题率至少一个周期"
        ]
      },
      riskLevel: "high"
    };
  }

  const instructionPatch = buildInstructionPatch(cluster.issueCode);
  return {
    title: `Prompt 优化：${cluster.issueCode}`,
    rationale: `${cluster.summary} 该问题可通过收紧用户可见输出约束进行验证。`,
    proposal: {
      instructionPatch,
      issueCode: cluster.issueCode,
      validation: {
        requiredBadcaseTraceIds: cluster.traceIds,
        acceptanceThreshold: "离线回放全部通过，且无新增边界或事实忠实问题"
      }
    },
    riskLevel: cluster.maxPriority >= 90 ? "high" : "medium"
  };
}

function buildInstructionPatch(issueCode: string) {
  if (/boundary|ignored_boundary/u.test(issueCode)) {
    return "当用户表达停止、拒绝继续、直接整理或追问无意义时，立即停止补槽位式追问；根据材料进入日志选择或低压选择。";
  }
  if (/abstract|clarity|multiple_questions|question_/u.test(issueCode)) {
    return "每轮只提出一个可以用具体片段回答的问题；优先沿用用户原话，避免抽象概念、并列问题和解释性长前缀。";
  }
  if (/ground|hallucin|anchor|factually_wrong|missing_supporting/u.test(issueCode)) {
    return "所有可见事实都必须能在当前上下文中找到依据；保留主场景与 supporting moments，禁止补写用户未提供的人物、动作、原因或结论。";
  }
  if (/tone|diagnosis|pressure|advice|self_blame/u.test(issueCode)) {
    return "保持低压、自然、非诊断语气；避免建议、归责、道德要求、心理标签和强制行动计划。";
  }
  if (/title/u.test(issueCode)) {
    return "标题使用不超过 16 字的自然语义短标题，概括具体体验，避免维度通用名、理论词和机械截断。";
  }
  return `针对 ${issueCode}：生成前核对用户边界、上下文事实、维度目标和自然中文表达；发现冲突时优先遵守用户边界与事实依据。`;
}
