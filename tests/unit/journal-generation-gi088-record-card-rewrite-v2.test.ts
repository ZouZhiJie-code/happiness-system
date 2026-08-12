import { rm } from "node:fs/promises";

import { buildGi088RecordCardWritingMaterial } from "../../scripts/journal-generation-eval/gi088-record-card-rewrite-contract";
import {
  buildGi088RecordCardRewriteV2Prompt,
  GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT,
  GI088_SHARED_NATURAL_JOURNAL_WRITING_CORE_V1,
  parseGi088RecordCardRewriteV2Output
} from "../../scripts/journal-generation-eval/gi088-record-card-rewrite-v2-contract";
import { loadGi088HumanExtensionSources } from "../../scripts/journal-generation-eval/gi088-human-extension-source";
import { createGi088MockCalibrationProvider } from "../../scripts/journal-generation-eval/gi088-calibration-provider";
import { loadGi088CalibrationSources } from "../../scripts/journal-generation-eval/gi088-calibration-runner";
import { GI088_JOURNAL_CALIBRATION_RUNTIME } from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import {
  loadCommittedGi088RecordCardRewriteV2,
  runGi088RecordCardRewriteV2
} from "../../scripts/journal-generation-eval/run-gi088-record-card-rewrite-v2";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

function validCandidate(material: ReturnType<typeof buildGi088RecordCardWritingMaterial>) {
  const evidence = material.userEvidence.filter((item) => item.usage === "content");
  const units: Array<{
    unitId: string;
    coreMeaning: string;
    evidenceSpans: Array<{ sourceRef: string; quote: string }>;
    validInsightRefs: string[];
    excludedInteractionSpans: Array<{ sourceRef: string; quote: string }>;
  }> = evidence.map((item, index) => ({
    unitId: `M${index + 1}`,
    coreMeaning: `第 ${index + 1} 个独立意思`,
    evidenceSpans: [{ sourceRef: item.sourceRef, quote: item.text }],
    validInsightRefs: index === 0
      ? material.validInsights.map((insight) => insight.sourceRef) : [],
    excludedInteractionSpans: []
  }));
  return {
    materialUnits: units,
    card: {
      title: { text: "这次经历里真正留下的感受以及后来逐渐形成的认识", usedUnitIds: [units[0].unitId] },
      paragraphs: [{
        text: evidence.map((item) => item.text).join("。"),
        usedUnitIds: units.map((unit) => unit.unitId)
      }]
    }
  };
}

describe("GI-088 记录卡 Prompt v2", () => {
  it("在一次调用中先整理材料单元，再写成单事件短文", async () => {
    const source = (await loadGi088HumanExtensionSources()).sources[0];
    const material = buildGi088RecordCardWritingMaterial(source);
    const prompt = buildGi088RecordCardRewriteV2Prompt(source, material);
    expect(prompt.messages).toHaveLength(2);
    expect(GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT).toContain(
      GI088_SHARED_NATURAL_JOURNAL_WRITING_CORE_V1
    );
    expect(GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT).toContain("materialUnits");
    expect(GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT).toContain("写透当前单个事件");
    expect(GI088_RECORD_CARD_REWRITE_V2_SYSTEM_PROMPT).toContain("逐字复制");
  });

  it("允许同义来源进入同一单元，并把标题长度作为软诊断", async () => {
    const source = (await loadGi088HumanExtensionSources()).sources[0];
    const material = buildGi088RecordCardWritingMaterial(source);
    const output = validCandidate(material);
    const parsed = parseGi088RecordCardRewriteV2Output({
      source,
      material,
      content: JSON.stringify(output),
      finishReason: "stop"
    });
    expect(parsed.accepted).toBe(true);
    expect(parsed.recordCard?.text).toContain(
      material.userEvidence.find((item) => item.usage === "content")?.text
    );
    expect(parsed.diagnostics.title_too_long).toHaveLength(1);
    expect(parsed.materialUnits[0].validInsightRefs).toEqual(
      material.validInsights.map((insight) => insight.sourceRef)
    );
  });

  it("拦截伪造来源片段、遗漏有效认识和互动片段原样泄漏", async () => {
    const source = (await loadGi088HumanExtensionSources()).sources[0];
    const material = buildGi088RecordCardWritingMaterial(source);
    const candidate = validCandidate(material);
    candidate.materialUnits[0].evidenceSpans[0].quote = "原话里不存在的片段";
    candidate.materialUnits[0].validInsightRefs = [];
    candidate.materialUnits[0].excludedInteractionSpans = [{
      sourceRef: material.userEvidence[0].sourceRef,
      quote: material.userEvidence[0].text.slice(0, 8)
    }] as Array<{ sourceRef: string; quote: string }>;
    candidate.card.paragraphs[0].text = material.userEvidence[0].text;
    const parsed = parseGi088RecordCardRewriteV2Output({
      source,
      material,
      content: JSON.stringify(candidate),
      finishReason: "stop"
    });
    expect(parsed.accepted).toBe(false);
    expect(parsed.issues.some((issue) => issue.includes("EVIDENCE_QUOTE_INVALID"))).toBe(true);
    expect(parsed.issues.some((issue) => issue.includes("VALID_INSIGHT_UNMAPPED"))).toBe(true);
    expect(parsed.issues.some((issue) => issue.includes("INTERACTION_SPAN_LEAKED"))).toBe(true);
  });

  it("默认检查零调用，模拟六次后可独立复算封存包", async () => {
    const inspection = await runGi088RecordCardRewriteV2({
      mode: "dry-run",
      confirmPrivateReplay: false,
      confirmScope: null,
      confirmParentExecution: null,
      maxCalls: 12,
      maxCallsExplicit: false,
      runId: null
    });
    expect(inspection.plan?.model_calls_executed).toBe(0);
    expect(inspection.plan?.selected_cases).toHaveLength(6);

    const result = await runGi088RecordCardRewriteV2({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScope: null,
      confirmParentExecution: null,
      maxCalls: 12,
      maxCallsExplicit: true,
      runId: `gi088-record-rewrite-v2-test-${Date.now()}`
    });
    if (!result.directory || !result.package) throw new Error("mock result unavailable");
    cleanup.push(result.directory);
    expect(result.package.run).toMatchObject({
      actual_model_calls: 6,
      technical_retries: 0,
      quality_retries: 0,
      admitted_cases: 6
    });
    expect(result.package.cases.every((item) => item.candidate.material_units.length > 0)).toBe(true);
    const loaded = await loadCommittedGi088RecordCardRewriteV2(
      result.directory,
      process.cwd(),
      true
    );
    expect(loaded.package.execution_fingerprint).toBe(result.package.execution_fingerprint);
  });

  it("同一合同可模拟完成三条稳定性案例，且与六条整改范围隔离", async () => {
    const stabilitySources = await loadGi088CalibrationSources();
    expect(stabilitySources.map((source) => source.selection.caseId)).toEqual([
      "private:sg-gi088-v6-single-focus:A2:high",
      "private:sg-gi088-v7r4-pro:A2:high",
      "private:sg-gi088-v8-question-decision-pro:A1:high"
    ]);
    const outputByCase = new Map(stabilitySources.map((source) => {
      const material = buildGi088RecordCardWritingMaterial(source);
      return [source.selection.caseId, JSON.stringify(validCandidate(material))];
    }));
    const provider = createGi088MockCalibrationProvider((request) => ({
      content: outputByCase.get(request.caseId) ?? "{}",
      latencyMs: 8,
      provider: "mock",
      finishReason: "stop",
      tokenUsage: null,
      upstreamRequestId: `mock-${request.caseId}`,
      reasoningPresent: false,
      reasoningTokens: 0,
      responseModel: "deepseek-v4-flash"
    }));
    let calls = 0;
    for (const source of stabilitySources) {
      const material = buildGi088RecordCardWritingMaterial(source);
      const prompt = buildGi088RecordCardRewriteV2Prompt(source, material);
      const response = await provider.complete({
        callFingerprint: `stability-${calls + 1}`,
        caseId: source.selection.caseId,
        candidateId: `stability-${calls + 1}`,
        stage: "record_card",
        attempt: 1,
        model: { layer: "flash", model: "deepseek-v4-flash", displayName: "DeepSeek V4 Flash" },
        messages: prompt.messages,
        promptHash: prompt.resolvedPromptHash,
        sourceRefs: material.allowedSourceRefs,
        sourceTextByRef: Object.fromEntries(material.userEvidence.map((item) => [item.sourceRef, item.text])),
        sourceRecordIds: [],
        sourceRecordTextById: {},
        runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
      });
      calls += 1;
      expect(parseGi088RecordCardRewriteV2Output({
        source,
        material,
        content: response.content,
        finishReason: response.finishReason ?? null
      }).accepted).toBe(true);
    }
    expect(calls).toBe(3);
  });
});
