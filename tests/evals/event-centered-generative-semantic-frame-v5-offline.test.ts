import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { eventCenteredLockedGenerativeVisibleSchema } from
  "@/features/interview/event-centered/ai-contract";
import {
  assertGenerativeSemanticFrameV5CandidateActive,
  assertGenerativeSemanticFrameV5OfflineOnly,
  formatGenerativeSemanticFrameV5OfflineConfirmationPackage,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CONFIRMATION_ARTIFACT_PATH,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET,
  generativeSemanticFrameV5OfflineCaseFingerprint
} from "@/features/interview/event-centered/generative-evaluation-runner";

describe.skipIf(!existsSync(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CONFIRMATION_ARTIFACT_PATH))(
  "semanticFrame v5 历史成果归属与统一回应确认包",
  () => {
  it("冻结六例、历史候选和独立运行授权门", () => {
    expect(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES).toHaveLength(6);
    expect(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET.candidateVersions)
      .toEqual(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS);
    expect(() => assertGenerativeSemanticFrameV5CandidateActive()).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V5_CANDIDATE_MISMATCH"
    );
    expect(() => assertGenerativeSemanticFrameV5OfflineOnly({
      confirmModelRun: true
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V5_MODEL_RUN_REQUIRES_SEPARATE_APPROVAL");
    expect(generativeSemanticFrameV5OfflineCaseFingerprint()).toBe(
      GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT
    );
  });

  it("六例同时覆盖用户成果、AI 综合、继续提问和材料有限", () => {
    const distribution = GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES.reduce(
      (result, item) => {
        const key = item.expectedDecision.origin ?? item.expectedDecision.state;
        result[key] = (result[key] ?? 0) + 1;
        return result;
      },
      {} as Record<string, number>
    );
    expect(distribution).toEqual({
      user_articulated: 3,
      needs_more: 1,
      ai_synthesized: 1,
      limited: 1
    });

    const actionCase = GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES.find(
      (item) => item.id === "SF4-A-EFFECT-01"
    )!;
    expect(actionCase.expectedDecision).toEqual({
      state: "ready",
      action: "complete",
      origin: "ai_synthesized"
    });
    expect(actionCase.currentUserText).toContain("手一直留在琴键上");
    expect(actionCase.expectedSemanticFrame?.relation?.type).toBe("change_effect");
  });

  it("封存的两条 expressible 回应都能归一为统一 response", () => {
    const archived = [
      "手碰到池壁那一下，你摘下泳镜，才发现自己在笑，肩膀也松了，那一刻就是松快。",
      "你手碰到池壁那一下，摘下泳镜，才发现自己在笑，肩膀也松了，那一刻就是松快。"
    ];
    for (const insight of archived) {
      expect(eventCenteredLockedGenerativeVisibleSchema.parse({
        status: "expressible",
        thinkingSummary: null,
        question: null,
        insight,
        honestLimit: null
      })).toEqual({
        thinkingSummary: null,
        response: insight,
        cannotExpressReason: null
      });
    }
  });

  it("确认包展示成果归属、统一回应协议和零模型预算", () => {
    const packageText = formatGenerativeSemanticFrameV5OfflineConfirmationPackage();
    expect(packageText).toContain("ready.origin");
    expect(packageText).toContain(
      "thinkingSummary / response / cannotExpressReason"
    );
    expect(packageText).toContain("当前模型请求预算：0 次");
    expect(packageText).toContain("ai_synthesized");
    expect(packageText).toContain(generativeSemanticFrameV5OfflineCaseFingerprint());
    expect(readFileSync(
      GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CONFIRMATION_ARTIFACT_PATH,
      "utf8"
    ).trimEnd()).toBe(packageText.trimEnd());
  });
  }
);
