import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("AI quality acceptance fixtures are disabled in production.");
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
      success: true,
      responseText: "清醒地开始"
    }
  });

  console.log(JSON.stringify({ username, badTraceId, goodTraceId, loginToken: process.env.ACCEPTANCE_LOGIN_TOKEN ?? "local-ai-quality-acceptance" }, null, 2));
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
