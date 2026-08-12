import { rm } from "node:fs/promises";

import {
  buildGi088RecordCardRewritePrompt,
  buildGi088RecordCardWritingMaterial,
  GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT,
  parseGi088RecordCardRewriteOutput
} from "../../scripts/journal-generation-eval/gi088-record-card-rewrite-contract";
import { loadGi088HumanExtensionSources } from "../../scripts/journal-generation-eval/gi088-human-extension-source";
import {
  loadCommittedGi088RecordCardRewrite,
  runGi088RecordCardRewrite
} from "../../scripts/journal-generation-eval/run-gi088-record-card-rewrite";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("GI-088 新版记录卡整改轮", () => {
  it("把提问降为隐藏语境，并按未否定规则保留当前有效认识", async () => {
    const bundle = await loadGi088HumanExtensionSources();
    const source = bundle.sources[0];
    const material = buildGi088RecordCardWritingMaterial(source);
    expect(material.questionContext.length).toBeGreaterThan(0);
    expect(material.questionContext.every((item) =>
      item.questions.every((question) => /[？?]/u.test(question))
    )).toBe(true);
    expect(material.userEvidence.some((item) => item.usage === "interaction_context")).toBe(true);
    expect(material.requiredSourceRefs).not.toContain(
      material.userEvidence.find((item) => item.usage === "interaction_context")?.sourceRef
    );
    expect(GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT).toContain("用户未否定或未纠正");
    expect(GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT).toContain("无需机械复制原句");
    const prompt = buildGi088RecordCardRewritePrompt(source, material);
    expect(prompt.messages).toHaveLength(2);
    expect(prompt.messages[1].content).not.toContain("梦里的比较，落回过去的自己");
  });

  it("严格检查来源覆盖、问题语境泄漏和纠正失效", async () => {
    const source = (await loadGi088HumanExtensionSources()).sources[0];
    const material = buildGi088RecordCardWritingMaterial(source);
    const firstContent = material.userEvidence.find((item) => item.usage === "content")!;
    const valid = parseGi088RecordCardRewriteOutput({
      source,
      material,
      finishReason: "stop",
      content: JSON.stringify({
        title: { text: "这次梦里的比较", sourceRefs: [firstContent.sourceRef] },
        paragraphs: [{
          text: material.userEvidence.filter((item) => item.usage === "content")
            .map((item) => item.text).join("。"),
          sourceRefs: material.requiredSourceRefs
        }]
      })
    });
    expect(valid.accepted).toBe(true);
    expect(valid.recordCard?.insight).toBe("");

    const omitted = parseGi088RecordCardRewriteOutput({
      source,
      material,
      finishReason: "stop",
      content: JSON.stringify({
        title: { text: "这次梦里的比较", sourceRefs: [firstContent.sourceRef] },
        paragraphs: [{ text: firstContent.text, sourceRefs: [firstContent.sourceRef] }]
      })
    });
    expect(omitted.accepted).toBe(false);
    expect(omitted.issues.some((item) => item.includes("REQUIRED_SOURCE_OMITTED"))).toBe(true);
  });

  it("默认检查模式零调用，模拟运行六次并可独立复算封存包", async () => {
    const inspection = await runGi088RecordCardRewrite({
      mode: "dry-run",
      confirmPrivateReplay: false,
      confirmScope: null,
      maxCalls: 12,
      maxCallsExplicit: false,
      runId: null
    });
    if (!inspection.plan) throw new Error("inspection unavailable");
    expect(inspection.plan.model_calls_executed).toBe(0);
    expect(inspection.plan.selected_cases).toHaveLength(6);

    const result = await runGi088RecordCardRewrite({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScope: null,
      maxCalls: 12,
      maxCallsExplicit: true,
      runId: `gi088-record-card-rewrite-test-${Date.now()}`
    });
    if (!result.package || !result.directory) throw new Error("mock result unavailable");
    cleanup.push(result.directory);
    expect(result.package.run).toMatchObject({
      actual_model_calls: 6,
      technical_retries: 0,
      quality_retries: 0,
      admitted_cases: 6
    });
    expect(result.package.prompt.few_shot_count).toBe(0);
    expect(result.package.cases.every((item) => item.candidate.record_card?.insight === "")).toBe(true);
    const loaded = await loadCommittedGi088RecordCardRewrite(result.directory, process.cwd(), true);
    expect(loaded.package.execution_fingerprint).toBe(result.package.execution_fingerprint);
  });

  it("拒绝越界运行目录，并避免同一轮真人材料被重复调用", async () => {
    await expect(runGi088RecordCardRewrite({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScope: null,
      maxCalls: 12,
      maxCallsExplicit: true,
      runId: "../outside-private-root"
    })).rejects.toThrow("GI088_RECORD_REWRITE_RUN_ID_INVALID");
  });
});
