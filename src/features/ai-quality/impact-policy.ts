import { createHash } from "node:crypto";

export const AI_QUALITY_OBSERVATION_DAYS = 7;
export const AI_QUALITY_MIN_SAMPLE = 5;

export type AIQualityIssueFamily =
  | "boundary"
  | "grounding"
  | "clarity"
  | "tone_safety"
  | "title"
  | "engineering"
  | "other";

export type AIQualityIssueKey = string;

export type AIQualityImpactMetrics = {
  generationCount: number;
  upvoteCount: number;
  downvoteCount: number;
  downvoteRate: number | null;
  sameIssueCount: number;
  sameIssueRate: number | null;
  severeIssueCount: number;
  failureCount: number;
  failureRate: number | null;
  averageLatencyMs: number | null;
};

export type AIQualityImpactConclusionStatus =
  | "observing"
  | "retain_recommended"
  | "review_required"
  | "rollback_recommended"
  | "low_sample";

export type AIQualityImpactConclusion = {
  status: AIQualityImpactConclusionStatus;
  title: string;
  summary: string;
  reasons: string[];
};

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function normalizeAIQualityIssueFamily(issueCode: string | null | undefined): AIQualityIssueFamily {
  const value = issueCode?.trim().toLowerCase() ?? "";
  if (!value) return "other";
  if (includesAny(value, [/boundary/u, /ignored_boundary/u, /stop_request/u, /user_override/u])) return "boundary";
  if (includesAny(value, [/ground/u, /hallucin/u, /fact/u, /anchor/u, /faithful/u, /supporting_scene/u])) return "grounding";
  if (includesAny(value, [/abstract/u, /clarity/u, /multiple_questions/u, /question_/u, /repetitive_question/u, /misunderstood/u, /easy_to_answer/u])) {
    return "clarity";
  }
  if (includesAny(value, [/tone/u, /diagnosis/u, /pressure/u, /advice/u, /self_blame/u, /safety/u])) return "tone_safety";
  if (/title/u.test(value)) return "title";
  if (includesAny(value, [/schema/u, /provider/u, /generation_not_completed/u, /missing_final_output/u, /database/u, /trace/u, /request_log/u])) {
    return "engineering";
  }
  return "other";
}

export function normalizeAIQualityIssueKey(issueCode: string | null | undefined): AIQualityIssueKey | null {
  const value = issueCode?.trim().toLowerCase();
  if (!value) return null;
  return value
    .replace(/^(?:user_downvote|feedback):/u, "")
    .replace(/[\s-]+/gu, "_")
    .replace(/_+/gu, "_");
}

export function isSevereAIQualityIssue(issueCode: string | null | undefined) {
  const value = issueCode?.trim().toLowerCase() ?? "";
  if (!value) return false;
  const family = normalizeAIQualityIssueFamily(value);
  if (family === "boundary") return /critical|ignored|hostile|stop/u.test(value);
  if (family === "grounding") return /hallucin|factually_wrong|critical|missing_supporting_scene/u.test(value);
  if (family === "tone_safety") return /diagnosis|danger|critical|unsafe/u.test(value);
  return false;
}

export function buildFewShotFingerprint(exampleIds: string[]) {
  return createHash("sha256").update(exampleIds.join(",")).digest("hex").slice(0, 10);
}

export function buildCandidateVersionMarker(input: {
  candidateId: string;
  path: "system_prompt" | "few_shot" | "engineering";
  fewShotExampleIds: string[];
}) {
  if (input.path === "system_prompt") return `+opt:${input.candidateId}`;
  if (input.path === "few_shot") return `+fs:${buildFewShotFingerprint(input.fewShotExampleIds)}`;
  return null;
}

export function calculateRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function calculateImpactWindow(input: {
  publishedAt: Date;
  now: Date;
  rolledBackAt?: Date | null;
  nextReleaseAt?: Date | null;
}) {
  const scheduledEnd = new Date(input.publishedAt.getTime() + AI_QUALITY_OBSERVATION_DAYS * 24 * 60 * 60 * 1000);
  const boundaries = [scheduledEnd, input.now, input.rolledBackAt, input.nextReleaseAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => left.getTime() - right.getTime());
  const observationEnd = boundaries[0] ?? input.now;
  const baselineStart = new Date(input.publishedAt.getTime() - AI_QUALITY_OBSERVATION_DAYS * 24 * 60 * 60 * 1000);
  const elapsedDays = Math.max(0, observationEnd.getTime() - input.publishedAt.getTime()) / (24 * 60 * 60 * 1000);
  const elapsedByNow = Math.max(0, input.now.getTime() - input.publishedAt.getTime()) / (24 * 60 * 60 * 1000);
  return {
    baselineStart,
    baselineEnd: input.publishedAt,
    observationStart: input.publishedAt,
    observationEnd,
    observedDay: Math.min(AI_QUALITY_OBSERVATION_DAYS, Math.max(1, Math.ceil(elapsedByNow))),
    completed: elapsedDays >= AI_QUALITY_OBSERVATION_DAYS || Boolean(input.rolledBackAt) || Boolean(input.nextReleaseAt)
  };
}

function delta(after: number | null, before: number | null) {
  if (after === null || before === null) return null;
  return after - before;
}

export function concludeAIQualityImpact(input: {
  baseline: AIQualityImpactMetrics;
  after: AIQualityImpactMetrics;
  completed: boolean;
}): AIQualityImpactConclusion {
  const downvoteDelta = delta(input.after.downvoteRate, input.baseline.downvoteRate);
  const issueDelta = delta(input.after.sameIssueRate, input.baseline.sameIssueRate);
  const failureDelta = delta(input.after.failureRate, input.baseline.failureRate);

  if (input.after.severeIssueCount > 0) {
    return {
      status: "rollback_recommended",
      title: "建议回滚",
      summary: "上线后出现了严重质量问题，建议先恢复上一版本，再查看真实对话。",
      reasons: [`观察期内发现 ${input.after.severeIssueCount} 条严重质量问题。`]
    };
  }

  if (input.after.generationCount < AI_QUALITY_MIN_SAMPLE) {
    if (input.completed) {
      return {
        status: "low_sample",
        title: "样本较少，请结合真实对话判断",
        summary: "七天观察已经结束，当前回复数量仍不足以形成稳定判断。",
        reasons: [`上线后共生成 ${input.after.generationCount} 条相关回复，建议优先查看真实案例。`]
      };
    }
    return {
      status: "observing",
      title: "继续观察",
      summary: "首批数据正在积累，当前未发现严重问题。",
      reasons: [`上线后已生成 ${input.after.generationCount} 条相关回复，达到 5 条后会给出更明确的方向。`]
    };
  }

  const issueWorse = issueDelta !== null && issueDelta > 0;
  const downvoteClearlyWorse = downvoteDelta !== null && downvoteDelta > 0.1;
  const failureClearlyWorse = failureDelta !== null && failureDelta > 0.05;
  if (issueWorse || downvoteClearlyWorse || failureClearlyWorse) {
    const reasons = [
      issueWorse ? "同一问题率较发布前上升。" : null,
      downvoteClearlyWorse ? "点踩率较发布前上升超过 10 个百分点。" : null,
      failureClearlyWorse ? "AI 调用失败率较发布前上升超过 5 个百分点。" : null
    ].filter((value): value is string => Boolean(value));
    return {
      status: "rollback_recommended",
      title: "建议回滚",
      summary: "核心质量指标出现明显退化，建议恢复上一版本并复核案例。",
      reasons
    };
  }

  if (input.completed) {
    const issueAcceptable = input.after.sameIssueRate === 0 || (issueDelta !== null && issueDelta <= 0);
    const downvoteAcceptable = downvoteDelta === null || downvoteDelta <= 0.05;
    const failureAcceptable = failureDelta === null || failureDelta <= 0.03;
    if (issueAcceptable && downvoteAcceptable && failureAcceptable) {
      return {
        status: "retain_recommended",
        title: "建议保留",
        summary: "七天观察期已结束，相关回复保持稳定或有所改善。",
        reasons: [
          "观察期内未发现严重质量问题。",
          input.after.sameIssueRate === 0 ? "上线后未再发现同一问题。" : "同一问题率较发布前下降。"
        ]
      };
    }
  }

  return {
    status: "review_required",
    title: "需要人工复核",
    summary: input.completed
      ? "七天数据处于中间区间，建议结合真实对话决定是否保留。"
      : "当前数据已具备参考价值，指标变化仍需结合真实对话判断。",
    reasons: ["暂未触发明确保留或回滚条件。"]
  };
}
