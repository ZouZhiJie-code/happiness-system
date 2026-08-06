import {
  GENERATIVE_DECISION_MOMENTS,
  generativeBoundaryEvaluationCases,
  generativeEvaluationCatalog,
  generativeSingleTurnEvaluationCases,
  generativeTrajectoryEvaluationCases
} from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  formatGenerativeHumanReviewPackage,
  runGenerativeBoundaryEvaluation,
  runGenerativeCatalogPreflight
} from "@/features/interview/event-centered/generative-evaluation-runner";
import {
  GENERATIVE_ARCHITECTURE_PROBE_CASES,
  GENERATIVE_QUALITY_CALIBRATION_CARDS
} from "@/features/interview/event-centered/generative-quality-calibration";

describe("generative interview evaluation catalog", () => {
  it("固定 24 条硬边界、32 条单轮和 8 段轨迹", () => {
    expect(generativeBoundaryEvaluationCases).toHaveLength(24);
    expect(generativeSingleTurnEvaluationCases).toHaveLength(32);
    expect(generativeTrajectoryEvaluationCases).toHaveLength(8);
    expect(generativeEvaluationCatalog).toHaveLength(64);
    expect(new Set(generativeEvaluationCatalog.map((item) => item.caseId)).size).toBe(64);
  });

  it("单轮集保持 24 条工作集与 8 条准入集，并覆盖八种角度模式组合", () => {
    const work = generativeSingleTurnEvaluationCases.filter((item) => item.split === "work");
    const gate = generativeSingleTurnEvaluationCases.filter((item) => item.split === "gate");

    expect(work).toHaveLength(24);
    expect(gate).toHaveLength(8);
    expect(new Set(gate.map((item) => `${item.angle}:${item.mode}`)).size).toBe(8);
    for (const moment of GENERATIVE_DECISION_MOMENTS) {
      expect(gate.filter((item) => item.decisionMoment === moment)).toHaveLength(2);
    }
    expect(new Set(work.map((item) => item.scenarioId))).toEqual(
      new Set(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"])
    );
    expect(new Set(gate.map((item) => item.scenarioId))).toEqual(
      new Set(["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08"])
    );
    expect(gate.some((item) => work.some((workItem) =>
      workItem.conversationContext[0]?.user === item.conversationContext[0]?.user ||
      workItem.rawText === item.rawText
    ))).toBe(false);
  });

  it("每个单轮案例都给出可执行动作、有限目标和人工判定锚点", () => {
    for (const item of generativeSingleTurnEvaluationCases) {
      expect(item.acceptableActions.length).toBeGreaterThan(0);
      expect(item.valuableTargets.length).toBeLessThanOrEqual(3);
      expect(item.mustHave.length).toBeGreaterThan(0);
      expect(item.mustNot.length).toBeGreaterThan(0);
      if (item.currentQuestion) {
        expect(item.currentQuestionCognitiveAction).not.toBeNull();
      }
      if (item.decisionMoment === "ask_value" || item.decisionMoment === "multiple_directions") {
        expect(item.acceptableActions).toContain("ask");
        expect(item.valuableTargets.length).toBeGreaterThan(0);
      } else {
        expect(item.acceptableActions).not.toContain("ask");
      }
    }
    expect(generativeSingleTurnEvaluationCases.find((item) => item.caseId === "S06-A")
      ?.currentQuestionCognitiveAction).toBe("anchor_specific");
  });

  it("A/B、正式准入和轨迹使用可审计且互相隔离的场景族", () => {
    const workFamilies = new Set(generativeSingleTurnEvaluationCases
      .filter((item) => item.split === "work")
      .map((item) => item.scenarioFamily));
    const gateFamilies = new Set(generativeSingleTurnEvaluationCases
      .filter((item) => item.split === "gate")
      .map((item) => item.scenarioFamily));
    const trajectoryFamilies = new Set(
      generativeTrajectoryEvaluationCases.map((item) => item.scenarioFamily)
    );
    const calibrationFamilies = new Set(
      GENERATIVE_QUALITY_CALIBRATION_CARDS.map((item) => item.scenarioFamily)
    );
    const probeFamilies = new Set(
      GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.scenarioFamily)
    );

    expect(workFamilies.size).toBe(8);
    expect(gateFamilies.size).toBe(8);
    expect(trajectoryFamilies.size).toBe(8);
    expect(calibrationFamilies.size).toBe(8);
    expect(probeFamilies.size).toBe(8);
    expect([...probeFamilies].some((family) =>
      workFamilies.has(family) || gateFamilies.has(family) ||
      trajectoryFamilies.has(family) || calibrationFamilies.has(family)
    )).toBe(false);
    expect([...gateFamilies].some((family) =>
      workFamilies.has(family) || trajectoryFamilies.has(family) ||
      calibrationFamilies.has(family) || probeFamilies.has(family)
    )).toBe(false);
    expect([...trajectoryFamilies].some((family) =>
      workFamilies.has(family) || gateFamilies.has(family) ||
      calibrationFamilies.has(family) || probeFamilies.has(family)
    )).toBe(false);
  });

  it("12 组反事实硬边界全部命中预期保护或放行", () => {
    const results = runGenerativeBoundaryEvaluation();

    expect(results).toHaveLength(24);
    expect(results.every((item) => item.passed)).toBe(true);
    expect(results.filter((item) => item.polarity === "protect")).toHaveLength(12);
    expect(results.filter((item) => item.polarity === "allow")).toHaveLength(12);
  });

  it("目录预检和两类人工评审包均可直接生成", () => {
    expect(runGenerativeCatalogPreflight()).toMatchObject({ passed: true });

    const workPackage = formatGenerativeHumanReviewPackage({ split: "work" });
    const gatePackage = formatGenerativeHumanReviewPackage({ split: "gate" });
    expect(workPackage).toContain("S01-B");
    expect(workPackage).toContain("T02");
    expect(gatePackage).toContain("G01");
    expect(gatePackage).toContain("T01");
  });
});
