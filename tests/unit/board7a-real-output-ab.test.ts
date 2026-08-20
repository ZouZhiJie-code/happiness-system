import { describe, expect, it } from "vitest";

import {
  BOARD7A_APPROVAL_VERSION,
  BOARD7A_CASES,
  BOARD7A_DATASET,
  BOARD7A_EVALUATION_ID,
  BOARD7A_REQUEST_BUDGET,
  BOARD7A_RUNTIME_CONFIG,
  createBoard7aPackageFingerprint,
  createBoard7aPairing,
  createCandidateBVisibleUserPrompt,
  createPendingBoard7aBudget,
  formatBoard7aBlindReview,
  parseCandidateAOutput,
  validateBoard7aApproval,
  validateCandidateOutput
} from "../../evals/event-centered-generative/board7a-real-output/board7a-real-output-ab";

describe("GI-081 Board7A six-case real-output package", () => {
  it("locks the 3 historical + 3 target and 2 record + 4 chat matrix", () => {
    expect(BOARD7A_CASES).toHaveLength(6);
    expect(new Set(BOARD7A_CASES.map((item) => item.id)).size).toBe(6);
    expect(BOARD7A_CASES.filter((item) => item.sourceKind === "historical_preview"))
      .toHaveLength(3);
    expect(BOARD7A_CASES.filter((item) => item.sourceKind === "target_rule_case"))
      .toHaveLength(3);
    expect(BOARD7A_CASES.filter((item) => item.mode === "help_record"))
      .toHaveLength(2);
    expect(BOARD7A_CASES.filter((item) => item.mode === "accompany_chat"))
      .toHaveLength(4);
    expect(BOARD7A_DATASET.sourcePolicy).toMatchObject({
      databaseClass: "local_isolated_preview",
      productionDataUsed: false,
      syntheticReplacementAllowed: false
    });
  });

  it("keeps historical cases traceable to exact isolated Preview message and trace ids", () => {
    for (const caseItem of BOARD7A_CASES.filter(
      (item) => item.sourceKind === "historical_preview"
    )) {
      expect(caseItem.source.rootSessionId).toMatch(/^[a-f0-9-]{36}$/u);
      expect(caseItem.source.messageIds).toEqual(
        caseItem.messages.map((message) => message.id)
      );
      expect(caseItem.source.traceIds).toBeInstanceOf(Array);
      expect((caseItem.source.traceIds as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("creates a deterministic balanced blind pairing without exposing it in the blind form", () => {
    const first = createBoard7aPairing();
    const second = createBoard7aPairing();
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    expect(first.filter((item) => item.left === "candidate_a")).toHaveLength(3);
    expect(first.filter((item) => item.left === "candidate_b")).toHaveLength(3);

    const blind = formatBoard7aBlindReview();
    expect(blind).toContain("回应甲");
    expect(blind).toContain("回应乙");
    expect(blind).toContain("（模型运行后写入）");
    expect(blind).not.toContain("candidate_a");
    expect(blind).not.toContain("candidate_b");
    expect(blind).not.toContain("结构化语义：");
  });

  it("parses candidate A JSON and separates product validation from technical parsing", () => {
    const caseItem = BOARD7A_CASES.find((item) => item.id === "T1")!;
    const output = parseCandidateAOutput(`\`\`\`json
      {
        "semantic": {
          "action": "acknowledge",
          "focus": "雨天狼狈后被同事照顾",
          "semanticSummary": "用户想记下狼狈中被一杯热豆浆照顾到的感受",
          "evidenceRefs": ["T1-U1"],
          "questionGoal": null,
          "limitReason": null
        },
        "visible": {
          "understanding": null,
          "response": "这杯热豆浆，让早上的狼狈里多了一点被照顾的暖意。"
        }
      }
    \`\`\``);
    expect(validateCandidateOutput({
      caseItem,
      semantic: output.semantic,
      visible: output.visible
    })).toEqual([]);

    expect(validateCandidateOutput({
      caseItem,
      semantic: {
        ...output.semantic,
        action: "ask",
        evidenceRefs: ["UNKNOWN"],
        questionGoal: "继续分析",
        limitReason: null
      },
      visible: {
        understanding: "你很在意这份照顾。",
        response: "你还想继续说说吗？"
      }
    })).toEqual(expect.arrayContaining([
      "UNKNOWN_EVIDENCE_REF:UNKNOWN",
      "ACTION_OUTSIDE_CASE_BOUNDARY:ask",
      "HELP_RECORD_ACTION_MUST_ACKNOWLEDGE"
    ]));
  });

  it("gives candidate B visible generation only its frozen semantic and referenced excerpts", () => {
    const caseItem = BOARD7A_CASES.find((item) => item.id === "H1")!;
    const prompt = JSON.parse(createCandidateBVisibleUserPrompt({
      caseItem,
      semantic: {
        action: "synthesize",
        focus: "爽和轻松同时存在",
        semanticSummary: "两种感受可以并存",
        evidenceRefs: [caseItem.latestUserMessageId, "UNKNOWN"],
        questionGoal: null,
        limitReason: null
      }
    })) as Record<string, unknown>;
    expect(prompt).not.toHaveProperty("conversation");
    expect(prompt).toHaveProperty("frozenSemantic");
    expect(prompt.evidenceExcerpts).toEqual([
      expect.objectContaining({ id: caseItem.latestUserMessageId })
    ]);
  });

  it("locks the 18 + 3 budget and rejects approval outside the exact package fingerprint", () => {
    expect(createPendingBoard7aBudget()).toMatchObject({
      status: "pending_approval",
      nominalGenerationRequests: 18,
      technicalRetriesMax: 3,
      generationRequestsMax: 21,
      generationRequestsUsed: 0,
      qualityRetriesUsed: 0
    });
    expect(BOARD7A_REQUEST_BUDGET.qualityRetries).toBe(0);
    expect(BOARD7A_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      thinking: "disabled"
    });

    const approval = {
      approvalType: BOARD7A_EVALUATION_ID,
      approvalVersion: BOARD7A_APPROVAL_VERSION,
      decision: "approved",
      approvedBy: "product_owner",
      approvedAt: "2026-08-06T15:00:00.000Z",
      confirmationText: "批准六题 A/B 首轮运行",
      packageFingerprint: createBoard7aPackageFingerprint(),
      datasetVersion: BOARD7A_DATASET.datasetVersion,
      caseIds: BOARD7A_CASES.map((item) => item.id),
      model: BOARD7A_RUNTIME_CONFIG.model,
      nominalGenerationRequests: 18,
      technicalRetriesMax: 3
    } as const;
    expect(validateBoard7aApproval(approval)).toEqual(approval);
    expect(() => validateBoard7aApproval({
      ...approval,
      packageFingerprint: "0".repeat(64)
    })).toThrow("BOARD7A_APPROVAL_SCOPE_FINGERPRINT_MISMATCH");
  });
});
