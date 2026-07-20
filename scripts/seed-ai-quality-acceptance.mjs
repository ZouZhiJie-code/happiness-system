import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("AI quality acceptance fixtures are disabled in production.");
}

function readLocalEnvValue(key) {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith(`${key}=`));
    if (!line) return null;

    const rawValue = line.slice(key.length + 1).trim();
    const isQuoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"));
    return isQuoted ? rawValue.slice(1, -1) : rawValue;
  } catch {
    return null;
  }
}

const acceptanceDatabaseUrl =
  process.env.DATABASE_URL ?? readLocalEnvValue("DATABASE_URL");
const acceptanceDatabaseHostname = acceptanceDatabaseUrl
  ? new URL(acceptanceDatabaseUrl).hostname
  : null;
const isLocalAcceptanceDatabase =
  acceptanceDatabaseHostname === "localhost" ||
  acceptanceDatabaseHostname === "127.0.0.1" ||
  acceptanceDatabaseHostname === "::1" ||
  acceptanceDatabaseHostname === "host.docker.internal";

if (
  !isLocalAcceptanceDatabase &&
  process.env.ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED !== "I_UNDERSTAND"
) {
  throw new Error(
    "AI quality acceptance fixtures require a local database. To use an isolated remote test database, explicitly set ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND."
  );
}

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const policyVersion = "2026-07-19";
const username = process.env.ACCEPTANCE_ADMIN_USERNAME ?? "acceptance_admin";
const password = process.env.ACCEPTANCE_ADMIN_PASSWORD ?? "Acceptance-Only-2026";

async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(value, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

async function seed() {
  const now = new Date();
  const existing = await prisma.user.findUnique({ where: { username } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          privacyPolicyVersion: policyVersion,
          aiQualityConsentVersion: policyVersion,
          aiQualityConsentAt: existing.aiQualityConsentAt ?? now,
          aiQualityConsentRevokedAt: null
        }
      })
    : await prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          agreedToTermsAt: now,
          agreedToPrivacyAt: now,
          privacyPolicyVersion: policyVersion,
          aiQualityConsentVersion: policyVersion,
          aiQualityConsentAt: now,
          settings: { create: {} }
        }
      });

  const badTraceId = "00000000-0000-4000-8000-000000000101";
  const goodTraceId = "00000000-0000-4000-8000-000000000102";
  const regressionTraceId = "00000000-0000-4000-8000-000000000103";

  await prisma.aIGenerationTrace.upsert({
    where: { id: badTraceId },
    create: {
      id: badTraceId,
      requestId: "acceptance-badcase-request",
      userId: user.id,
      dimension: "reflection",
      artifactType: "interview_turn",
      artifactId: "acceptance-interview-turn",
      status: "completed",
      outputOrigin: "llm",
      contextSnapshot: {
        userPrompt: "我不想继续追问了",
        userMessage: "我不想继续追问了",
        context: [],
        systemPromptVersion: "acceptance-v1"
      },
      finalOutput: {
        insight: "",
        thinkingSummary: "我理解你想停下来。",
        analysis: "",
        question: "能再具体讲讲当时发生了什么吗？",
        questionSpec: null,
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceKind: null,
          choiceReason: ""
        },
        meta: { depthReached: ["event"] }
      },
      pipelineDecisions: { fixture: "ai-quality-acceptance" },
      completedAt: now
    },
    update: {
      userId: user.id,
      status: "completed",
      outputOrigin: "llm",
      contextSnapshot: {
        userPrompt: "我不想继续追问了",
        userMessage: "我不想继续追问了",
        context: [],
        systemPromptVersion: "acceptance-v1"
      },
      finalOutput: {
        insight: "",
        thinkingSummary: "我理解你想停下来。",
        analysis: "",
        question: "能再具体讲讲当时发生了什么吗？",
        questionSpec: null,
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceKind: null,
          choiceReason: ""
        },
        meta: { depthReached: ["event"] }
      },
      completedAt: now
    }
  });

  const badFeedback = await prisma.aIFeedback.upsert({
    where: { traceId: badTraceId },
    create: {
      traceId: badTraceId,
      userId: user.id,
      vote: "downvote",
      tags: ["ignored_boundary"],
      comment: "用户已经表达停止，回复仍在继续追问。",
      privacyPolicyVersion: policyVersion
    },
    update: {
      userId: user.id,
      vote: "downvote",
      tags: ["ignored_boundary"],
      comment: "用户已经表达停止，回复仍在继续追问。",
      status: "active",
      revokedAt: null,
      privacyPolicyVersion: policyVersion
    }
  });
  await prisma.aIFeedbackRevision.upsert({
    where: { feedbackId_revision: { feedbackId: badFeedback.id, revision: badFeedback.revision } },
    create: {
      feedbackId: badFeedback.id,
      revision: badFeedback.revision,
      vote: "downvote",
      tags: ["ignored_boundary"],
      comment: "用户已经表达停止，回复仍在继续追问。",
      status: "active"
    },
    update: { status: "active" }
  });
  await prisma.aICase.upsert({
    where: { traceId: badTraceId },
    create: {
      traceId: badTraceId,
      classification: "bad",
      priority: 100,
      sourceSignals: ["user_downvote"],
      primaryIssueCode: "user_downvote:ignored_boundary",
      summary: "用户已经表达停止，回复仍在继续追问。"
    },
    update: {
      classification: "bad",
      priority: 100,
      sourceSignals: ["user_downvote"],
      primaryIssueCode: "user_downvote:ignored_boundary",
      summary: "用户已经表达停止，回复仍在继续追问。"
    }
  });
  await prisma.aIRequestLog.deleteMany({ where: { requestId: "acceptance-badcase-request", stage: "question" } });
  await prisma.aIRequestLog.create({
    data: {
      traceId: badTraceId,
      requestId: "acceptance-badcase-request",
      stage: "question",
      attempt: 1,
      provider: "acceptance-fixture",
      model: "acceptance-model",
      promptKey: "interview.question.reflection",
      promptVersion: "acceptance-v1",
      requestMessages: [
        {
          role: "system",
          content: `你是幸福日志访谈助手。只返回严格 JSON，不能使用 Markdown。所有字段都必须存在，格式固定为：
{"insight":"","thinkingSummary":"自然中文","analysis":"自然中文","question":"","questionSpec":null,"stateUpdate":{"turnPhase":"choice","shouldEndDimension":true,"offerChoice":true,"choiceKind":"event_complete","choiceReason":"自然中文"},"meta":{"depthReached":[]}}
用户表达停止、不想继续、直接整理时，question 必须为空，offerChoice 必须为 true，choiceKind 使用 event_complete。depthReached 只能从 event、feeling、reason、clue、pattern 中选择。`
        },
        { role: "user", content: "我不想继续追问了" }
      ],
      success: true,
      responseText: JSON.stringify({
        insight: "",
        thinkingSummary: "我理解你想停下来。",
        analysis: "",
        question: "能再具体讲讲当时发生了什么吗？",
        questionSpec: null,
        stateUpdate: { turnPhase: "digging", shouldEndDimension: false, offerChoice: false, choiceKind: null, choiceReason: "" },
        meta: { depthReached: ["event"] }
      })
    }
  });

  await prisma.aIGenerationTrace.upsert({
    where: { id: goodTraceId },
    create: {
      id: goodTraceId,
      requestId: "acceptance-goodcase-request",
      userId: user.id,
      dimension: "joy",
      artifactType: "dimension_journal",
      artifactId: "acceptance-dimension-journal",
      status: "completed",
      outputOrigin: "llm",
      contextSnapshot: { userPrompt: "整理成开心日志", context: ["早起后多出半小时"], systemPromptVersion: "acceptance-v1" },
      finalOutput: { title: "清醒地开始", content: "早起后多出的半小时，让今天有了从容而清醒的开场。" },
      pipelineDecisions: { fixture: "ai-quality-acceptance" },
      completedAt: now
    },
    update: { userId: user.id, status: "completed", outputOrigin: "llm", completedAt: now }
  });
  const goodFeedback = await prisma.aIFeedback.upsert({
    where: { traceId: goodTraceId },
    create: {
      traceId: goodTraceId,
      userId: user.id,
      vote: "upvote",
      tags: ["faithful_to_intent", "appropriate_title"],
      comment: "内容准确，标题自然。",
      privacyPolicyVersion: policyVersion
    },
    update: {
      userId: user.id,
      vote: "upvote",
      tags: ["faithful_to_intent", "appropriate_title"],
      comment: "内容准确，标题自然。",
      status: "active",
      revokedAt: null,
      privacyPolicyVersion: policyVersion
    }
  });
  await prisma.aIFeedbackRevision.upsert({
    where: { feedbackId_revision: { feedbackId: goodFeedback.id, revision: goodFeedback.revision } },
    create: {
      feedbackId: goodFeedback.id,
      revision: goodFeedback.revision,
      vote: "upvote",
      tags: ["faithful_to_intent", "appropriate_title"],
      comment: "内容准确，标题自然。",
      status: "active"
    },
    update: { status: "active" }
  });
  await prisma.aIEvaluation.upsert({
    where: { traceId: goodTraceId },
    create: {
      traceId: goodTraceId,
      status: "completed",
      trigger: "manual",
      rubricVersion: "acceptance-v1",
      ruleScore: 92,
      judgeScore: 92,
      totalScore: 92,
      dimensionScores: { fidelity: 95, clarity: 90 },
      deductions: [],
      reasons: ["验收用高质量样例"],
      ruleSignals: ["user_upvote"],
      judgeTriggered: true,
      judgeTriggerReason: "manual"
    },
    update: { status: "completed", totalScore: 92, evaluatedAt: now }
  });
  await prisma.aICase.upsert({
    where: { traceId: goodTraceId },
    create: {
      traceId: goodTraceId,
      classification: "good",
      priority: 10,
      sourceSignals: ["user_upvote"],
      summary: "获得点赞且自动评分为 92 分。"
    },
    update: { classification: "good", priority: 10, sourceSignals: ["user_upvote"] }
  });
  await prisma.aIRequestLog.deleteMany({ where: { requestId: "acceptance-goodcase-request", stage: "generate" } });
  await prisma.aIRequestLog.create({
    data: {
      traceId: goodTraceId,
      requestId: "acceptance-goodcase-request",
      stage: "generate",
      attempt: 1,
      provider: "acceptance-fixture",
      model: "acceptance-model",
      promptKey: "interview.journal.joy",
      promptVersion: "acceptance-v1",
      requestMessages: [
        { role: "system", content: "请根据用户提供的事实生成自然、忠实的开心日志，并以 JSON 输出标题和正文。" },
        { role: "user", content: "早起后多出半小时，请整理成开心日志。" }
      ],
      success: true,
      responseText: "清醒地开始"
    }
  });

  await prisma.aIGenerationTrace.upsert({
    where: { id: regressionTraceId },
    create: {
      id: regressionTraceId,
      requestId: "acceptance-regression-request",
      userId: user.id,
      dimension: "reflection",
      artifactType: "interview_turn",
      artifactId: "acceptance-regression-turn",
      status: "completed",
      outputOrigin: "llm",
      contextSnapshot: { userMessage: "我发现自己做决定前总会先担心别人怎么看。", systemPromptVersion: "acceptance-v1" },
      finalOutput: {
        insight: "你注意到自己的判断常常先经过别人眼光这一层。",
        thinkingSummary: "这可能是一个值得继续看清的判断习惯。",
        analysis: "继续追问具体判断依据。",
        question: "今天哪个决定最能让你看到这种顾虑？",
        questionSpec: null,
        stateUpdate: { turnPhase: "digging", shouldEndDimension: false, offerChoice: false, choiceKind: null, choiceReason: "" },
        meta: { depthReached: ["clue"] }
      },
      pipelineDecisions: { fixture: "ai-quality-regression" },
      completedAt: now
    },
    update: { userId: user.id, status: "completed", outputOrigin: "llm", completedAt: now }
  });
  const regressionFeedback = await prisma.aIFeedback.upsert({
    where: { traceId: regressionTraceId },
    create: {
      traceId: regressionTraceId,
      userId: user.id,
      vote: "upvote",
      tags: ["understood_accurately", "easy_to_answer"],
      comment: "追问具体，也准确接住了我的意思。",
      privacyPolicyVersion: policyVersion
    },
    update: {
      userId: user.id,
      vote: "upvote",
      tags: ["understood_accurately", "easy_to_answer"],
      comment: "追问具体，也准确接住了我的意思。",
      status: "active",
      revokedAt: null,
      privacyPolicyVersion: policyVersion
    }
  });
  await prisma.aIFeedbackRevision.upsert({
    where: { feedbackId_revision: { feedbackId: regressionFeedback.id, revision: regressionFeedback.revision } },
    create: {
      feedbackId: regressionFeedback.id,
      revision: regressionFeedback.revision,
      vote: "upvote",
      tags: ["understood_accurately", "easy_to_answer"],
      comment: "追问具体，也准确接住了我的意思。",
      status: "active"
    },
    update: { status: "active" }
  });
  await prisma.aIEvaluation.upsert({
    where: { traceId: regressionTraceId },
    create: {
      traceId: regressionTraceId,
      status: "completed",
      trigger: "manual",
      rubricVersion: "acceptance-v1",
      ruleScore: 92,
      judgeScore: 92,
      totalScore: 92,
      dimensionScores: { clarity: 92, boundarySafety: 100 },
      deductions: [],
      reasons: ["验收用正常访谈回归样例"],
      ruleSignals: ["user_upvote"],
      judgeTriggered: true,
      judgeTriggerReason: "manual"
    },
    update: { status: "completed", totalScore: 92, evaluatedAt: now }
  });
  await prisma.aICase.upsert({
    where: { traceId: regressionTraceId },
    create: {
      traceId: regressionTraceId,
      classification: "good",
      priority: 10,
      sourceSignals: ["user_upvote"],
      summary: "正常访谈追问获得点赞且自动评分为 92 分。"
    },
    update: { classification: "good", priority: 10, sourceSignals: ["user_upvote"] }
  });
  await prisma.aIRequestLog.deleteMany({ where: { requestId: "acceptance-regression-request", stage: "question" } });
  await prisma.aIRequestLog.create({
    data: {
      traceId: regressionTraceId,
      requestId: "acceptance-regression-request",
      stage: "question",
      attempt: 1,
      provider: "acceptance-fixture",
      model: "acceptance-model",
      promptKey: "interview.question.reflection",
      promptVersion: "acceptance-v1",
      requestMessages: [
        {
          role: "system",
          content: `你是幸福日志访谈助手。只返回严格 JSON，不能使用 Markdown。所有字段都必须存在。正常访谈每轮只问一个具体问题，格式示例：
{"insight":"自然中文","thinkingSummary":"自然中文","analysis":"自然中文","question":"一个具体问题？","questionSpec":null,"stateUpdate":{"turnPhase":"digging","shouldEndDimension":false,"offerChoice":false,"choiceKind":null,"choiceReason":""},"meta":{"depthReached":["clue"]}}`
        },
        { role: "user", content: "我发现自己做决定前总会先担心别人怎么看。" }
      ],
      success: true,
      responseText: "验收用正常访谈回复"
    }
  });

  const impactRunId = "ai-quality-impact-acceptance-run";
  const impactClusterId = "ai-quality-impact-acceptance-cluster";
  const impactCandidateId = "ai-quality-impact-acceptance-candidate";
  const impactValidationId = "ai-quality-impact-acceptance-validation";
  const impactPromptKey = "acceptance.impact.reflection";
  const impactPublishedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const impactBaselineStart = new Date(impactPublishedAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.aIOptimizationRun.upsert({
    where: { id: impactRunId },
    create: {
      id: impactRunId,
      periodStart: impactBaselineStart,
      periodEnd: impactPublishedAt,
      status: "completed",
      scannedBad: 2,
      scannedGood: 4,
      clusterCount: 1,
      candidateCount: 1,
      summary: "验收样例：历史版本已完成七天观察。",
      startedAt: impactBaselineStart,
      completedAt: impactPublishedAt
    },
    update: {
      status: "completed",
      periodStart: impactBaselineStart,
      periodEnd: impactPublishedAt,
      summary: "验收样例：历史版本已完成七天观察。",
      completedAt: impactPublishedAt
    }
  });
  await prisma.aIBadcaseCluster.upsert({
    where: { id: impactClusterId },
    create: {
      id: impactClusterId,
      runId: impactRunId,
      artifactType: "interview_turn",
      dimension: "reflection",
      issueCode: "ignored_boundary",
      caseCount: 2,
      traceIds: [],
      summary: "历史样例中，用户表达停止后 AI 仍继续追问。",
      suggestedPath: "system_prompt",
      createdAt: impactBaselineStart
    },
    update: {
      issueCode: "ignored_boundary",
      caseCount: 2,
      summary: "历史样例中，用户表达停止后 AI 仍继续追问。"
    }
  });
  await prisma.aIOptimizationCandidate.upsert({
    where: { dedupeKey: "ai-quality-impact-acceptance-v1" },
    create: {
      id: impactCandidateId,
      dedupeKey: "ai-quality-impact-acceptance-v1",
      runId: impactRunId,
      clusterId: impactClusterId,
      path: "system_prompt",
      status: "published",
      artifactType: "interview_turn",
      dimension: "reflection",
      promptKey: impactPromptKey,
      title: "验收样例：尊重停止边界",
      rationale: "用于立即验收发布前后七天效果对比。",
      proposal: { instructionPatch: "用户表达停止时，及时收住并提供低压结束方式。" },
      evidenceTraceIds: [],
      riskLevel: "medium",
      createdAt: impactBaselineStart,
      reviewedBy: username,
      reviewedAt: impactPublishedAt,
      publishedBy: username,
      publishedAt: impactPublishedAt
    },
    update: {
      runId: impactRunId,
      clusterId: impactClusterId,
      status: "published",
      promptKey: impactPromptKey,
      publishedBy: username,
      publishedAt: impactPublishedAt,
      rolledBackBy: null,
      rolledBackAt: null
    }
  });
  await prisma.aIOptimizationValidation.upsert({
    where: { id: impactValidationId },
    create: {
      id: impactValidationId,
      candidateId: impactCandidateId,
      status: "passed",
      rubricVersion: "acceptance-v1",
      targetCaseCount: 2,
      targetPassedCount: 2,
      regressionCaseCount: 2,
      regressionPassedCount: 2,
      criticalRegressionCount: 0,
      averageScoreDelta: 12,
      summary: "历史验收样例验证通过。",
      results: [],
      startedAt: new Date(impactPublishedAt.getTime() - 60 * 60 * 1000),
      completedAt: impactPublishedAt,
      createdBy: username
    },
    update: {
      status: "passed",
      targetCaseCount: 2,
      targetPassedCount: 2,
      regressionCaseCount: 2,
      regressionPassedCount: 2,
      criticalRegressionCount: 0,
      averageScoreDelta: 12,
      completedAt: impactPublishedAt
    }
  });
  const existingImpactRelease = await prisma.aIPromptRelease.findFirst({
    where: { candidateId: impactCandidateId },
    orderBy: { version: "desc" }
  });
  if (existingImpactRelease) {
    await prisma.aIPromptRelease.update({
      where: { id: existingImpactRelease.id },
      data: {
        validationId: impactValidationId,
        promptKey: impactPromptKey,
        status: "published",
        publishedAt: impactPublishedAt,
        rolledBackBy: null,
        rolledBackAt: null
      }
    });
  } else {
    await prisma.aIPromptRelease.create({
      data: {
        candidateId: impactCandidateId,
        validationId: impactValidationId,
        promptKey: impactPromptKey,
        version: 1,
        instructionPatch: "用户表达停止时，及时收住并提供低压结束方式。",
        fewShotExampleIds: [],
        status: "published",
        publishedBy: username,
        publishedAt: impactPublishedAt
      }
    });
  }

  const impactTraceIds = [];
  for (let index = 0; index < 12; index += 1) {
    const afterRelease = index >= 6;
    const sequence = afterRelease ? index - 6 : index;
    const createdAt = afterRelease
      ? new Date(impactPublishedAt.getTime() + (sequence + 1) * 20 * 60 * 60 * 1000)
      : new Date(impactPublishedAt.getTime() - (6 - sequence) * 20 * 60 * 60 * 1000);
    const traceId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const requestId = `acceptance-impact-${afterRelease ? "after" : "before"}-${sequence + 1}`;
    const isDownvote = afterRelease ? sequence === 0 : sequence < 2;
    const issueCode = afterRelease && isDownvote ? "tone_review" : isDownvote ? "ignored_boundary" : null;
    impactTraceIds.push(traceId);

    await prisma.aIGenerationTrace.upsert({
      where: { id: traceId },
      create: {
        id: traceId,
        requestId,
        userId: user.id,
        dimension: "reflection",
        artifactType: "interview_turn",
        artifactId: `${requestId}-turn`,
        status: "completed",
        outputOrigin: "llm",
        contextSnapshot: {
          userMessage: afterRelease ? "今天先聊到这里吧" : "我想先停一下",
          messages: [
            { id: `${requestId}-user`, role: "user", content: afterRelease ? "今天先聊到这里吧" : "我想先停一下" }
          ],
          systemPromptVersion: afterRelease ? `acceptance-v1+opt:${impactCandidateId}` : "acceptance-v1"
        },
        finalOutput: {
          thinkingSummary: afterRelease ? "我知道你想先停在这里。" : "我理解你想停一下。",
          question: afterRelease ? "" : "能再讲讲当时发生了什么吗？"
        },
        pipelineDecisions: { fixture: "ai-quality-impact-acceptance", phase: afterRelease ? "after" : "baseline" },
        completedAt: createdAt,
        createdAt
      },
      update: {
        userId: user.id,
        status: "completed",
        outputOrigin: "llm",
        completedAt: createdAt,
        createdAt,
        contextSnapshot: {
          userMessage: afterRelease ? "今天先聊到这里吧" : "我想先停一下",
          messages: [
            { id: `${requestId}-user`, role: "user", content: afterRelease ? "今天先聊到这里吧" : "我想先停一下" }
          ],
          systemPromptVersion: afterRelease ? `acceptance-v1+opt:${impactCandidateId}` : "acceptance-v1"
        },
        finalOutput: {
          thinkingSummary: afterRelease ? "我知道你想先停在这里。" : "我理解你想停一下。",
          question: afterRelease ? "" : "能再讲讲当时发生了什么吗？"
        }
      }
    });
    const impactFeedback = await prisma.aIFeedback.upsert({
      where: { traceId },
      create: {
        traceId,
        userId: user.id,
        vote: isDownvote ? "downvote" : "upvote",
        tags: isDownvote ? [issueCode ?? "tone_review"] : ["respects_pace"],
        comment: isDownvote
          ? afterRelease
            ? "已经尊重停止了，语气还可以更自然。"
            : "表达停止后仍继续追问。"
          : "回复及时收住，也尊重了我的节奏。",
        privacyPolicyVersion: policyVersion,
        createdAt,
        updatedAt: createdAt
      },
      update: {
        userId: user.id,
        vote: isDownvote ? "downvote" : "upvote",
        tags: isDownvote ? [issueCode ?? "tone_review"] : ["respects_pace"],
        comment: isDownvote
          ? afterRelease
            ? "已经尊重停止了，语气还可以更自然。"
            : "表达停止后仍继续追问。"
          : "回复及时收住，也尊重了我的节奏。",
        status: "active",
        revokedAt: null,
        privacyPolicyVersion: policyVersion,
        createdAt,
        updatedAt: createdAt
      }
    });
    await prisma.aIFeedbackRevision.upsert({
      where: { feedbackId_revision: { feedbackId: impactFeedback.id, revision: impactFeedback.revision } },
      create: {
        feedbackId: impactFeedback.id,
        revision: impactFeedback.revision,
        vote: isDownvote ? "downvote" : "upvote",
        tags: isDownvote ? [issueCode ?? "tone_review"] : ["respects_pace"],
        comment: isDownvote ? "验收问题反馈" : "验收正向反馈",
        status: "active",
        createdAt
      },
      update: { status: "active", createdAt }
    });
    await prisma.aIEvaluation.upsert({
      where: { traceId },
      create: {
        traceId,
        status: "completed",
        trigger: "manual",
        rubricVersion: "acceptance-v1",
        ruleScore: isDownvote ? 72 : 94,
        judgeScore: isDownvote ? 72 : 94,
        totalScore: isDownvote ? 72 : 94,
        dimensionScores: { boundarySafety: issueCode === "ignored_boundary" ? 30 : 95, clarity: 90 },
        deductions: issueCode ? [{ dimension: issueCode === "ignored_boundary" ? "boundarySafety" : "clarity", points: 20, reason: issueCode }] : [],
        reasons: issueCode ? ["验收样例需要复核。"] : ["验收样例质量稳定。"],
        ruleSignals: issueCode ? [issueCode] : [],
        judgeTriggered: true,
        judgeTriggerReason: "manual",
        evaluatedAt: createdAt
      },
      update: {
        status: "completed",
        totalScore: isDownvote ? 72 : 94,
        ruleSignals: issueCode ? [issueCode] : [],
        evaluatedAt: createdAt
      }
    });
    await prisma.aICase.upsert({
      where: { traceId },
      create: {
        traceId,
        classification: isDownvote ? (afterRelease ? "review" : "bad") : "good",
        priority: isDownvote ? 70 : 10,
        sourceSignals: [isDownvote ? "user_downvote" : "user_upvote"],
        primaryIssueCode: issueCode,
        summary: isDownvote
          ? afterRelease
            ? "回复已经尊重停止，语气仍可复核。"
            : "用户表达停止后，AI 仍继续追问。"
          : "用户认可 AI 及时尊重停止边界。",
        createdAt,
        updatedAt: createdAt
      },
      update: {
        classification: isDownvote ? (afterRelease ? "review" : "bad") : "good",
        primaryIssueCode: issueCode,
        updatedAt: createdAt
      }
    });
    await prisma.aIRequestLog.deleteMany({ where: { requestId } });
    await prisma.aIRequestLog.create({
      data: {
        traceId,
        requestId,
        stage: "question",
        attempt: 1,
        provider: "acceptance-fixture",
        model: "acceptance-model",
        promptKey: impactPromptKey,
        promptVersion: afterRelease ? `acceptance-v1+opt:${impactCandidateId}+fs:e3b0c44298` : "acceptance-v1",
        requestMessages: [{ role: "user", content: afterRelease ? "今天先聊到这里吧" : "我想先停一下" }],
        responseText: afterRelease ? "好的，我们先停在这里。" : "能再讲讲当时发生了什么吗？",
        success: true,
        latencyMs: afterRelease ? 760 + sequence * 10 : 1120 + sequence * 15,
        createdAt
      }
    });
  }

  await prisma.aIOptimizationCandidate.update({
    where: { id: impactCandidateId },
    data: { evidenceTraceIds: impactTraceIds.slice(0, 2) }
  });
  await prisma.aIBadcaseCluster.update({
    where: { id: impactClusterId },
    data: { traceIds: impactTraceIds.slice(0, 2) }
  });

  console.log(JSON.stringify({
    username,
    badTraceId,
    goodTraceId,
    regressionTraceId,
    impactCandidateId,
    loginToken: process.env.ACCEPTANCE_LOGIN_TOKEN ?? "local-ai-quality-acceptance"
  }, null, 2));
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
