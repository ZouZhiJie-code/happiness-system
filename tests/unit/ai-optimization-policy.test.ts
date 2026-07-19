import {
  buildOptimizationProposal,
  chooseOptimizationPath,
  clusterBadcases,
  getPromptKeyForArtifact
} from "@/features/ai-quality/optimization-policy";

describe("AI optimization policy", () => {
  it("clusters exact issue patterns and orders higher-risk clusters first", () => {
    const clusters = clusterBadcases([
      {
        traceId: "trace-1",
        artifactType: "interview_turn",
        dimension: "reflection",
        issueCode: "boundary_critical_not_respected",
        summary: null,
        priority: 100
      },
      {
        traceId: "trace-2",
        artifactType: "interview_turn",
        dimension: "reflection",
        issueCode: "boundary_critical_not_respected",
        summary: null,
        priority: 90
      },
      {
        traceId: "trace-3",
        artifactType: "dimension_journal",
        dimension: "joy",
        issueCode: "invalid_journal_payload",
        summary: null,
        priority: 70
      }
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toMatchObject({
      issueCode: "boundary_critical_not_respected",
      caseCount: 2,
      traceIds: ["trace-1", "trace-2"],
      suggestedPath: "system_prompt"
    });
    expect(clusters[1]).toMatchObject({
      issueCode: "invalid_journal_payload",
      suggestedPath: "engineering"
    });
  });

  it("routes structural failures to engineering and user-visible quality issues to prompt review", () => {
    expect(chooseOptimizationPath("provider_generation_not_completed")).toBe("engineering");
    expect(chooseOptimizationPath("schema_parse_failed")).toBe("engineering");
    expect(chooseOptimizationPath("user_downvote:too_abstract")).toBe("system_prompt");
    expect(getPromptKeyForArtifact("dimension_journal", "gratitude")).toBe("interview.journal.gratitude");
  });

  it("produces an auditable, boundary-specific prompt proposal", () => {
    const proposal = buildOptimizationProposal({
      artifactType: "interview_turn",
      dimension: "reflection",
      issueCode: "ignored_boundary",
      traceIds: ["trace-1"],
      caseCount: 1,
      summary: "1 条 reflection 生成命中 ignored_boundary。",
      suggestedPath: "system_prompt",
      maxPriority: 100
    });

    expect(proposal.riskLevel).toBe("high");
    expect(proposal.proposal).toMatchObject({
      issueCode: "ignored_boundary",
      validation: { requiredBadcaseTraceIds: ["trace-1"] }
    });
    expect((proposal.proposal as { instructionPatch: string }).instructionPatch).toContain("立即停止");
  });
});
