import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

type JsonRecord = Record<string, unknown>;

const projectRoot = process.cwd();
const base = resolve(
  projectRoot,
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1"
);
const privateBase = resolve(base, ".private");
const expectPending = process.argv.includes("--expect-pending");
const publicOnly = process.argv.includes("--public-only");

function fail(message: string): never {
  throw new Error(message);
}

function readJson(path: string): JsonRecord {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function array(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) fail(`${label}_NOT_ARRAY`);
  return value as JsonRecord[];
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${label}_NOT_TEXT`);
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label}_NOT_NUMBER`);
  return value;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function countBy(items: JsonRecord[], key: string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const value = text(item[key], `${key}_VALUE`);
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function assertDistribution(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}:${JSON.stringify(actual)}`);
  }
}

function walkKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => walkKeys(item, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value as JsonRecord).forEach(([key, item]) => {
      keys.add(key);
      walkKeys(item, keys);
    });
  }
  return keys;
}

const judgePath = resolve(base, "judge-calibration-20.json");
const blueprintPath = resolve(base, "independent-admission-blueprint-12.json");
const judge = readJson(judgePath);
const blueprint = readJson(blueprintPath);
const judgeIdentity = judge.datasetIdentity as JsonRecord;
const blueprintIdentity = blueprint.datasetIdentity as JsonRecord;
const judgeCards = array(judge.cards, "JUDGE_CARDS");
const retiredCards = array(judge.retiredCards, "RETIRED_CARDS");
const hiddenCases = array(blueprint.cases, "HIDDEN_CASES");

if (judgeIdentity.version !== "2026-08-13.v2") fail("JUDGE_VERSION");
if (blueprintIdentity.version !== "2026-08-13.blueprint-v2") fail("BLUEPRINT_VERSION");
if (judgeCards.length !== 20) fail(`JUDGE_COUNT:${judgeCards.length}`);
if (retiredCards.length !== 2) fail(`RETIRED_COUNT:${retiredCards.length}`);
assertDistribution(
  countBy(judgeCards, "goldLabel"),
  { direct_use: 5, minor_issue: 5, quality_failure: 5, single_case_blocker: 5 },
  "JUDGE_LABEL_DISTRIBUTION"
);

const activeIds = new Set(judgeCards.map((card) => text(card.caseId, "CASE_ID")));
if (activeIds.size !== 20) fail("JUDGE_ACTIVE_ID_DUPLICATE");
for (const retiredId of ["JC-SB-02", "JC-SB-04"]) {
  if (!retiredCards.some((card) => card.caseId === retiredId)) fail(`RETIRED_MISSING:${retiredId}`);
  if (activeIds.has(retiredId)) fail(`RETIRED_STILL_ACTIVE:${retiredId}`);
}
for (const requiredId of [
  "JC-SB-01",
  "JC-SB-03",
  "JC-SB-05",
  "JC-SB-06",
  "JC-SB-07"
]) {
  if (!activeIds.has(requiredId)) fail(`BLOCKER_COVERAGE_MISSING:${requiredId}`);
}

const privateCards = judgeCards.filter((card) => card.payloadStatus === "private_redaction_ready");
if (privateCards.length !== 7) fail(`PRIVATE_REDACTED_COUNT:${privateCards.length}`);
if (judgeCards.some((card) => card.newStandardCompatibility === "quality_axis_reconfirmation_required")) {
  fail("JUDGE_AXIS_RECONFIRMATION_REMAINS");
}

if (hiddenCases.length !== 12) fail(`HIDDEN_COUNT:${hiddenCases.length}`);
const standardized = hiddenCases.filter((item) => item.caseType === "standardized_decision_point");
const trajectories = hiddenCases.filter((item) => item.caseType === "complete_trajectory");
if (standardized.length !== 8 || trajectories.length !== 4) fail("HIDDEN_8_PLUS_4");
assertDistribution(countBy(standardized, "recordMode"), { capture: 2, chat: 6 }, "STANDARD_MODE");
assertDistribution(countBy(trajectories, "recordMode"), { capture: 2, chat: 2 }, "TRAJECTORY_MODE");
const resultsByMode = hiddenCases.reduce<Record<string, number>>((result, item) => {
  const mode = text(item.recordMode, "HIDDEN_MODE");
  result[mode] = (result[mode] ?? 0) + number(item.plannedResultCount, "PLANNED_RESULTS");
  return result;
}, {});
assertDistribution(resultsByMode, { capture: 8, chat: 20 }, "RESULT_MODE");

const hiddenCaseKeys = walkKeys(hiddenCases);
for (const forbidden of ["dialogue", "expectedAnswer", "scoringNotes", "blockerTrigger", "privateTopicBody"]) {
  if (hiddenCaseKeys.has(forbidden)) fail(`PUBLIC_HIDDEN_FIELD:${forbidden}`);
}

const gitFiles = spawnSync("git", ["ls-files"], { cwd: projectRoot, encoding: "utf8" });
if (gitFiles.status !== 0) fail("GIT_LS_FILES_FAILED");
const trackedPrivate = gitFiles.stdout
  .split("\n")
  .filter((path) => path.includes("2026-08-13-gi088-dual-track-v1/.private/"));
if (trackedPrivate.length > 0) fail(`PRIVATE_FILES_TRACKED:${trackedPrivate.join(",")}`);

const publicResult = {
  result: "pass",
  judgeActiveCards: judgeCards.length,
  judgeRetiredCards: retiredCards.length,
  judgeDistribution: countBy(judgeCards, "goldLabel"),
  hiddenBlueprintCases: hiddenCases.length,
  standardizedModeDistribution: countBy(standardized, "recordMode"),
  trajectoryModeDistribution: countBy(trajectories, "recordMode"),
  plannedResultModeDistribution: resultsByMode,
  privateFilesTracked: trackedPrivate.length
};

if (publicOnly) {
  console.log(JSON.stringify({ status: "GI088_STAGE_B2_PUBLIC_PASS", public: publicResult }, null, 2));
  process.exit(0);
}

const redactedDir = resolve(privateBase, "judge-calibration-v2/redacted-payloads");
const blindPath = resolve(privateBase, "judge-calibration-v2/judge-blind-package.json");
const mappingPath = resolve(privateBase, "judge-calibration-v2/gold-mapping.json");
for (const path of [redactedDir, blindPath, mappingPath]) {
  if (!existsSync(path)) fail(`PRIVATE_JUDGE_ASSET_MISSING:${path}`);
}
const redactedFiles = readdirSync(redactedDir).filter((file) => file.endsWith(".json"));
if (redactedFiles.length !== 7) fail(`REDACTED_FILE_COUNT:${redactedFiles.length}`);
for (const card of privateCards) {
  const payloadPath = resolve(projectRoot, text(card.payloadLocation, `PAYLOAD:${card.caseId}`));
  if (!existsSync(payloadPath)) fail(`PRIVATE_PAYLOAD_MISSING:${card.caseId}`);
}

const piiPattern = /(\b1[3-9]\d{9}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|邹志杰|粽子|问问大象|1500|奶奶|男朋友)/iu;
for (const file of redactedFiles) {
  const content = readFileSync(resolve(redactedDir, file), "utf8");
  if (piiPattern.test(content)) fail(`REDACTED_PII_PATTERN:${file}`);
}

const blind = readJson(blindPath);
const mapping = readJson(mappingPath);
const blindItems = array(blind.items, "BLIND_ITEMS");
const mappingItems = array(mapping.items, "MAPPING_ITEMS");
if (blindItems.length !== 20 || mappingItems.length !== 20) fail("BLIND_MAPPING_COUNT");
const forbiddenBlindKeys = new Set([
  "caseId",
  "goldLabel",
  "title",
  "expectedBehavior",
  "prohibitedBehavior",
  "whyAdded",
  "source",
  "technicalFailure",
  "validationIssues"
]);
for (const key of walkKeys(blind)) {
  if (forbiddenBlindKeys.has(key)) fail(`BLIND_FORBIDDEN_KEY:${key}`);
}
if (/JC-[A-Z]{2}-\d{2}/u.test(readFileSync(blindPath, "utf8"))) fail("BLIND_ORIGINAL_ID_LEAK");
const blindIds = new Set(blindItems.map((item) => text(item.blindId, "BLIND_ID")));
const mappingBlindIds = new Set(mappingItems.map((item) => text(item.blindId, "MAPPING_BLIND_ID")));
if (blindIds.size !== 20 || mappingBlindIds.size !== 20) fail("BLIND_ID_DUPLICATE");
if ([...blindIds].some((id) => !mappingBlindIds.has(id))) fail("BLIND_MAPPING_MISMATCH");
if (mappingItems.some((item) => !activeIds.has(text(item.caseId, "MAPPING_CASE_ID")))) {
  fail("MAPPING_INACTIVE_CASE");
}

const intakePath = resolve(privateBase, "independent-admission-v2/real-topic-intake.json");
const identityPath = resolve(privateBase, "independent-admission-v2/private-dataset-identity.json");
const tombstonePath = resolve(privateBase, "independent-admission-v2/withdrawal-tombstones.json");
for (const path of [intakePath, identityPath, tombstonePath]) {
  if (!existsSync(path)) fail(`PRIVATE_HIDDEN_CONTRACT_MISSING:${path}`);
}
const intake = readJson(intakePath);
const identity = readJson(identityPath);
const topics = array(intake.topics, "REAL_TOPICS");
if (topics.length !== 2) fail(`REAL_TOPIC_SLOT_COUNT:${topics.length}`);
const authorizedTopics = topics.filter(
  (topic) =>
    topic.purposeConsent === true &&
    topic.privateRetentionConsent === true &&
    topic.externalJudgeConsent === true &&
    topic.withdrawalAcknowledged === true &&
    typeof topic.naturalOpeningMaterial === "string" &&
    topic.naturalOpeningMaterial.length > 0
).length;
const bodyCount = number(identity.bodyCount, "PRIVATE_BODY_COUNT");
const exactDuplicates = typeof identity.exactDuplicateCount === "number" ? identity.exactDuplicateCount : null;
const unresolvedNearLeaks =
  typeof identity.unresolvedSemanticLeakageCount === "number"
    ? identity.unresolvedSemanticLeakageCount
    : null;
const hiddenReady =
  bodyCount === 12 &&
  authorizedTopics === 2 &&
  exactDuplicates === 0 &&
  unresolvedNearLeaks === 0 &&
  typeof identity.bodySha256 === "string" &&
  identity.bodySha256.length === 64;

const privateResult = {
  judgeRedactedPayloads: redactedFiles.length,
  blindItems: blindItems.length,
  blindForbiddenKeyLeaks: 0,
  blindOriginalIdLeaks: 0,
  realTopicSlots: topics.length,
  realTopicsAuthorized: authorizedTopics,
  hiddenBodiesReady: bodyCount,
  exactDuplicateCount: exactDuplicates,
  unresolvedSemanticLeakageCount: unresolvedNearLeaks,
  judgeBlindSha256: sha256(blindPath),
  judgeGoldMappingSha256: sha256(mappingPath),
  hiddenDatasetSha256: identity.bodySha256 ?? null
};

if (!hiddenReady) {
  const output = {
    status: "GI088_STAGE_B2_PRIVATE_HIDDEN_PENDING",
    public: publicResult,
    private: privateResult,
    pending: [
      "两条真实话题填写与四项逐题授权",
      "全新独立任务建设并冻结 12 条隐藏正文",
      "正文完成后的精确重复与近义泄漏检查",
      "私有数据集正文指纹"
    ],
    executionBoundary: {
      businessModelCalls: 0,
      judgeModelCalls: 0,
      humanEvaluationSubmissions: 0,
      previewChanges: 0,
      productionChanges: 0
    }
  };
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = expectPending ? 0 : 2;
} else {
  console.log(
    JSON.stringify(
      {
        status: "GI088_STAGE_B2_READY_FOR_STAGE_C_AUTHORIZATION_REQUEST",
        public: publicResult,
        private: privateResult,
        executionBoundary: {
          businessModelCalls: 0,
          judgeModelCalls: 0,
          humanEvaluationSubmissions: 0,
          previewChanges: 0,
          productionChanges: 0
        }
      },
      null,
      2
    )
  );
}
