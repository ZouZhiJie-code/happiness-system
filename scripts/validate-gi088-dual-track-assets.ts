import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = resolve(
  projectRoot,
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1"
);

const files = {
  development: "development-challenge-28.json",
  hardBoundary: "hard-boundary-regression-24.json",
  judge: "judge-calibration-20.json",
  hiddenBlueprint: "independent-admission-blueprint-12.json",
  caseSchema: "case-identity.schema.json",
  datasetSchema: "dataset-identity.schema.json",
  runSchema: "run-identity.schema.json"
} as const;

type JsonRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`GI088_DUAL_TRACK_ASSET_INVALID:${message}`);
}

function readJson(name: string): JsonRecord {
  return JSON.parse(readFileSync(resolve(assetRoot, name), "utf8")) as JsonRecord;
}

function records(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) fail(`${label}_NOT_ARRAY`);
  return value as JsonRecord[];
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${label}_MISSING`);
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label}_MISSING`);
  return value;
}

function countBy(items: JsonRecord[], key: string) {
  const result: Record<string, number> = {};
  for (const item of items) {
    const value = text(item[key], `${key}_VALUE`);
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function assertDistribution(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string
) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}:${JSON.stringify(actual)}`);
  }
}

function assertUniqueIds(groups: Array<{ label: string; items: JsonRecord[] }>) {
  const seen = new Map<string, string>();
  for (const group of groups) {
    for (const item of group.items) {
      const caseId = text(item.caseId, `${group.label}_CASE_ID`);
      const prior = seen.get(caseId);
      if (prior) fail(`DUPLICATE_CASE_ID:${caseId}:${prior}:${group.label}`);
      seen.set(caseId, group.label);
    }
  }
  return seen;
}

function assertDatasetIdentity(dataset: JsonRecord, expectedCount: number) {
  const identity = dataset.datasetIdentity as JsonRecord | undefined;
  if (!identity) fail("DATASET_IDENTITY_MISSING");
  if (number(identity.itemCount, "DATASET_ITEM_COUNT") !== expectedCount) {
    fail(`DATASET_ITEM_COUNT_MISMATCH:${identity.datasetId}`);
  }
  for (const key of [
    "datasetId",
    "version",
    "purpose",
    "supportedDecision",
    "collection",
    "frozenAt",
    "visibility"
  ]) {
    text(identity[key], `DATASET_IDENTITY_${key}`);
  }
  if (!Array.isArray(identity.knownLimitations)) fail("KNOWN_LIMITATIONS_MISSING");
  if (!Array.isArray(identity.changeHistory)) fail("CHANGE_HISTORY_MISSING");
}

function assertCaseIdentity(item: JsonRecord) {
  for (const key of [
    "caseId",
    "title",
    "scene",
    "userGoal",
    "expectedBehavior",
    "riskLevel",
    "collection",
    "privacyLevel",
    "whyAdded",
    "version",
    "status"
  ]) {
    text(item[key], `CASE_${key}`);
  }
  if (!Array.isArray(item.prohibitedBehavior)) {
    fail(`CASE_PROHIBITED_BEHAVIOR:${item.caseId}`);
  }
  const source = item.source as JsonRecord | undefined;
  if (!source) fail(`CASE_SOURCE:${item.caseId}`);
  for (const key of ["kind", "ref", "authorization", "privacy"]) {
    text(source[key], `CASE_SOURCE_${key}:${item.caseId}`);
  }
}

function assertSourcesExist(items: JsonRecord[], internalIds: Set<string>) {
  for (const item of items) {
    const source = item.source as JsonRecord;
    const ref = text(source.ref, `SOURCE_REF:${item.caseId}`);
    if (ref.startsWith("private:") || internalIds.has(ref)) continue;
    if (!existsSync(resolve(projectRoot, ref))) {
      fail(`SOURCE_NOT_FOUND:${item.caseId}:${ref}`);
    }
  }
}

const hiddenForbiddenKeys = new Set([
  "story",
  "person",
  "dialogue",
  "input",
  "expectedAnswer",
  "scoringNotes",
  "blockerTrigger",
  "privateTopic"
]);

function assertNoHiddenBody(value: unknown, path = "hiddenBlueprint") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoHiddenBody(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (hiddenForbiddenKeys.has(key)) fail(`HIDDEN_BODY_KEY_LEAK:${path}.${key}`);
    assertNoHiddenBody(child, `${path}.${key}`);
  }
}

function sha256(name: string) {
  return createHash("sha256")
    .update(readFileSync(resolve(assetRoot, name)))
    .digest("hex");
}

function assertJudgeProtocol(judge: JsonRecord) {
  const route = judge.plannedJudgeRoute as JsonRecord | undefined;
  const review = judge.formalRunReviewProtocol as JsonRecord | undefined;
  if (!route || !review) fail("JUDGE_PROTOCOL_MISSING");
  if (route.primaryModel !== "qwen3.7-plus-2026-05-26") {
    fail("JUDGE_PRIMARY_MODEL_MISMATCH");
  }
  if (route.fallbackModel !== "qwen3.7-max-2026-06-08") {
    fail("JUDGE_FALLBACK_MODEL_MISMATCH");
  }
  if (
    !Array.isArray(route.primaryModes) ||
    route.primaryModes.join(",") !== "normal,thinking"
  ) {
    fail("JUDGE_MODE_PLAN_MISMATCH");
  }
  for (const key of [
    "judgeScope",
    "productOwnerScope",
    "delayedReview",
    "recalibrationTrigger",
    "finalAuthority"
  ]) {
    text(review[key], `JUDGE_REVIEW_${key}`);
  }
}

function assertAdmissionProtocol(hiddenBlueprint: JsonRecord) {
  const execution = hiddenBlueprint.executionPlan as JsonRecord | undefined;
  const aggregation = hiddenBlueprint.repeatedCaseAggregation as
    | JsonRecord
    | undefined;
  const gate = hiddenBlueprint.admissionGate as JsonRecord | undefined;
  if (!execution || !aggregation || !gate) fail("ADMISSION_PROTOCOL_MISSING");
  if (number(execution.plannedValidResults, "PLANNED_VALID_RESULTS") !== 28) {
    fail("ADMISSION_PLANNED_RESULTS_MISMATCH");
  }
  for (const key of [
    "directUse",
    "minorIssue",
    "qualityFailure",
    "singleCaseBlocker"
  ]) {
    text(aggregation[key], `ADMISSION_AGGREGATION_${key}`);
  }
  if (
    gate.qualifiedCases !== "12/12" ||
    gate.minimumDirectUseCases !== 9 ||
    gate.maximumMinorIssueCases !== 3 ||
    gate.maximumQualityFailures !== 0 ||
    gate.maximumSingleCaseBlockers !== 0 ||
    gate.requiredValidResults !== 28
  ) {
    fail("ADMISSION_ABSOLUTE_GATE_MISMATCH");
  }
}

function main() {
  const development = readJson(files.development);
  const hardBoundary = readJson(files.hardBoundary);
  const judge = readJson(files.judge);
  const hiddenBlueprint = readJson(files.hiddenBlueprint);
  const developmentCases = records(development.cases, "DEVELOPMENT_CASES");
  const hardCases = records(hardBoundary.cases, "HARD_CASES");
  const judgeCards = records(judge.cards, "JUDGE_CARDS");
  const hiddenCases = records(hiddenBlueprint.cases, "HIDDEN_CASES");

  assertDatasetIdentity(development, 28);
  assertDatasetIdentity(hardBoundary, 24);
  assertDatasetIdentity(judge, 20);
  assertDatasetIdentity(hiddenBlueprint, 12);
  [...developmentCases, ...hardCases, ...judgeCards, ...hiddenCases].forEach(
    assertCaseIdentity
  );
  const allIds = assertUniqueIds([
    { label: "development", items: developmentCases },
    { label: "hard", items: hardCases },
    { label: "judge", items: judgeCards },
    { label: "hidden", items: hiddenCases }
  ]);

  assertDistribution(
    countBy(developmentCases, "caseType"),
    {
      existing_gi088_challenge: 12,
      human_adjudicated_historical_failure: 8,
      single_variable_counterfactual: 8
    },
    "DEVELOPMENT_DISTRIBUTION"
  );
  assertDistribution(
    countBy(hardCases, "family"),
    {
      user_control: 4,
      safety: 4,
      correction: 4,
      source_truth: 4,
      event_isolation: 4,
      recovery: 4
    },
    "HARD_BOUNDARY_DISTRIBUTION"
  );
  assertDistribution(
    countBy(judgeCards, "goldLabel"),
    {
      direct_use: 5,
      minor_issue: 5,
      quality_failure: 5,
      single_case_blocker: 5
    },
    "JUDGE_DISTRIBUTION"
  );
  assertDistribution(
    countBy(hiddenCases, "caseType"),
    { standardized_decision_point: 8, complete_trajectory: 4 },
    "HIDDEN_TYPE_DISTRIBUTION"
  );
  assertJudgeProtocol(judge);
  assertAdmissionProtocol(hiddenBlueprint);

  const developmentIds = new Set(
    developmentCases.map((item) => text(item.caseId, "DEVELOPMENT_ID"))
  );
  for (const item of developmentCases.filter(
    (candidate) => candidate.caseType === "single_variable_counterfactual"
  )) {
    const parent = text(item.parentCaseId, `COUNTERFACTUAL_PARENT:${item.caseId}`);
    if (!developmentIds.has(parent)) fail(`COUNTERFACTUAL_PARENT_NOT_FOUND:${parent}`);
    text(item.changedVariable, `COUNTERFACTUAL_VARIABLE:${item.caseId}`);
  }

  const internalIds = new Set(allIds.keys());
  assertSourcesExist(
    [...developmentCases, ...hardCases, ...judgeCards, ...hiddenCases],
    internalIds
  );
  for (const card of judgeCards) {
    const payloadLocation = text(card.payloadLocation, `PAYLOAD:${card.caseId}`);
    if (
      (card.payloadStatus === "private_redaction_required" ||
        card.payloadStatus === "private_redaction_ready") &&
      !existsSync(resolve(projectRoot, payloadLocation))
    ) {
      fail(`PRIVATE_PAYLOAD_NOT_FOUND:${card.caseId}`);
    }
  }

  assertNoHiddenBody(hiddenBlueprint);
  const hiddenStoryFamilies = new Set<string>();
  let plannedResults = 0;
  for (const item of hiddenCases) {
    const storyFamilyKey = text(item.storyFamilyKey, `HIDDEN_FAMILY:${item.caseId}`);
    if (hiddenStoryFamilies.has(storyFamilyKey)) {
      fail(`HIDDEN_FAMILY_DUPLICATE:${storyFamilyKey}`);
    }
    hiddenStoryFamilies.add(storyFamilyKey);
    if (!(item.source as JsonRecord).ref?.toString().startsWith("private:")) {
      fail(`HIDDEN_SOURCE_NOT_PRIVATE:${item.caseId}`);
    }
    if (!text(item.bodyStatus, `HIDDEN_BODY_STATUS:${item.caseId}`).includes("pending")) {
      fail(`HIDDEN_BODY_UNEXPECTEDLY_PRESENT:${item.caseId}`);
    }
    plannedResults += number(item.plannedResultCount, `HIDDEN_RESULTS:${item.caseId}`);
  }
  if (plannedResults !== 28) fail(`HIDDEN_PLANNED_RESULTS:${plannedResults}`);

  const judgeVersion = text(
    (judge.datasetIdentity as JsonRecord).version,
    "JUDGE_DATASET_VERSION"
  );
  const privateJudgeCards = judgeCards.filter((card) =>
    ["private_redaction_required", "private_redaction_ready"].includes(
      String(card.payloadStatus)
    )
  ).length;
  const privateJudgeCardsPending = judgeCards.filter(
    (card) => card.payloadStatus === "private_redaction_required"
  ).length;
  const axisReconfirmationCards = judgeCards.filter(
    (card) => card.newStandardCompatibility === "quality_axis_reconfirmation_required"
  ).length;
  if (privateJudgeCards !== 7) fail(`PRIVATE_JUDGE_CARD_COUNT:${privateJudgeCards}`);
  const expectedAxisReconfirmationCards = judgeVersion === "2026-08-13.v2" ? 0 : 4;
  if (axisReconfirmationCards !== expectedAxisReconfirmationCards) {
    fail(
      `AXIS_RECONFIRMATION_CARD_COUNT:${axisReconfirmationCards}:EXPECTED:${expectedAxisReconfirmationCards}`
    );
  }
  if (judgeVersion === "2026-08-13.v2") {
    const retiredCards = records(judge.retiredCards, "JUDGE_RETIRED_CARDS");
    if (retiredCards.length !== 2) fail(`JUDGE_RETIRED_CARD_COUNT:${retiredCards.length}`);
  }

  const fingerprints = Object.fromEntries(
    Object.entries(files).map(([key, name]) => [key, { file: name, sha256: sha256(name) }])
  );
  console.log(
    JSON.stringify(
      {
        result: "GI088_DUAL_TRACK_ASSET_VALIDATION_PASS",
        checksPassed: [
          "dataset_identity",
          "case_identity",
          "counts_and_distribution",
          "unique_case_ids",
          "source_files",
          "counterfactual_parent_and_single_variable",
          "judge_balance_and_private_payload_presence",
          "judge_route_and_human_review_protocol",
          "hidden_blueprint_no_body_fields",
          "hidden_story_family_isolation",
          "independent_admission_aggregation_and_absolute_gate",
          "planned_result_count"
        ],
        counts: {
          development: developmentCases.length,
          hardBoundary: hardCases.length,
          judgeCalibration: judgeCards.length,
          hiddenBlueprint: hiddenCases.length,
          independentAdmissionPlannedResults: plannedResults
        },
        knownGaps: {
          judgeCardsRequiringPrivateRedaction: privateJudgeCardsPending,
          judgeCardsRequiringQualityAxisReconfirmation: axisReconfirmationCards,
          hiddenBodiesPending: hiddenCases.length
        },
        modelCalls: 0,
        humanEvaluationSubmissions: 0,
        previewChanges: 0,
        productionChanges: 0,
        fingerprints
      },
      null,
      2
    )
  );
}

main();
