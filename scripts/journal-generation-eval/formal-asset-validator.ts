import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface EvaluationPlan {
  status: string;
  dataset: {
    total_case_count: number;
    development_split: { case_count: number; composition: Record<string, number> };
    independent_admission_split: { case_count: number; composition: Record<string, number> };
  };
  derived_case_recipes: { recipe_count: number };
  judge_calibration: { packet_count: number };
}

interface DevCase {
  case_id: string;
  role: "seed" | "human" | "derived";
  source_group_id: string;
  synthetic: boolean;
  privacy: string;
  content_status: string;
  parent_case_id?: string;
  recipe_id?: string;
  private_source_ref?: { source_id: string; completed_trajectory_ordinal: number };
}

interface DevManifest {
  expected_case_count: number;
  composition: Record<DevCase["role"], number>;
  cases: DevCase[];
}

interface HiddenSlot {
  slot_id: string;
  kind: "new_private_human" | "post_freeze_independent_synthetic";
  synthetic: boolean;
  source_group_id: null;
  content_status: "intentionally_unfilled";
  materialized_path: null;
  [key: string]: unknown;
}

interface HiddenManifest {
  expected_case_count: number;
  composition: {
    new_private_human: number;
    post_freeze_independent_synthetic: number;
  };
  slots: HiddenSlot[];
}

interface DerivedRecipe {
  recipe_id: string;
  derived_case_id: string;
  parent_case_id: string;
  parameter_placeholders: string[];
  must_invariants: string[];
  p0_blockers: string[];
  materialized_path: string;
}

interface DerivedRecipes {
  recipe_count: number;
  recipes: DerivedRecipe[];
}

interface JudgeSlot {
  calibration_id: string;
  target_stratum: "p0_violation" | "clean_or_non_p0";
  content_status: "intentionally_unfilled";
  source_case_id: null;
  gold_label: null;
  materialized_path: null;
}

interface JudgeManifest {
  packet_count: number;
  target_structure: {
    p0_violation_target_slots: number;
    clean_or_non_p0_target_slots: number;
  };
  gate: { p0_recall_min: number; precision_min: number };
  slots: JudgeSlot[];
}

interface SeedDataset {
  cases: Array<{ case_id: string; source_group_id: string; synthetic: boolean }>;
}

export interface FormalAssetBundle {
  plan: EvaluationPlan;
  dev: DevManifest;
  hidden: HiddenManifest;
  recipes: DerivedRecipes;
  judge: JudgeManifest;
  seeds: SeedDataset;
}

export class FormalAssetValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function invariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) {
    throw new FormalAssetValidationError(code, message);
  }
}

function unique(values: string[]) {
  return new Set(values).size === values.length;
}

export function validateFormalAssetBundle(bundle: FormalAssetBundle) {
  const { plan, dev, hidden, recipes, judge, seeds } = bundle;
  invariant(plan.status === "skeleton_only_unexecuted", "PLAN_STATUS_INVALID", "正式评测计划必须保持未执行骨架状态。");
  invariant(plan.dataset.total_case_count === 40, "TOTAL_COUNT_INVALID", "正式数据集必须为 40 个案例。");
  invariant(plan.dataset.development_split.case_count === 28, "DEV_PLAN_COUNT_INVALID", "开发集计划必须为 28 个案例。");
  invariant(plan.dataset.independent_admission_split.case_count === 12, "HIDDEN_PLAN_COUNT_INVALID", "独立准入集计划必须为 12 个案例。");
  invariant(plan.derived_case_recipes.recipe_count === 9, "RECIPE_PLAN_COUNT_INVALID", "派生配方计划必须为 9 个。");
  invariant(plan.judge_calibration.packet_count === 20, "JUDGE_PLAN_COUNT_INVALID", "Judge 校准包计划必须为 20 个。");

  invariant(dev.expected_case_count === 28 && dev.cases.length === 28, "DEV_COUNT_INVALID", "dev28 清单必须恰好包含 28 个案例。");
  invariant(unique(dev.cases.map((item) => item.case_id)), "DEV_CASE_ID_DUPLICATED", "dev28 case_id 必须唯一。");
  const devByRole = {
    seed: dev.cases.filter((item) => item.role === "seed"),
    human: dev.cases.filter((item) => item.role === "human"),
    derived: dev.cases.filter((item) => item.role === "derived")
  };
  invariant(devByRole.seed.length === 10 && dev.composition.seed === 10, "DEV_SEED_COUNT_INVALID", "dev28 必须包含 10 个种子案例。");
  invariant(devByRole.human.length === 9 && dev.composition.human === 9, "DEV_HUMAN_COUNT_INVALID", "dev28 必须包含 9 个真人案例。");
  invariant(devByRole.derived.length === 9 && dev.composition.derived === 9, "DEV_DERIVED_COUNT_INVALID", "dev28 必须包含 9 个派生案例。");
  const seedIds = new Set(seeds.cases.map((item) => item.case_id));
  invariant(devByRole.seed.every((item) => seedIds.has(item.case_id) && item.synthetic), "DEV_SEED_REF_INVALID", "dev28 种子必须引用现有合成案例。");
  invariant(devByRole.human.every((item) => !item.synthetic
    && item.privacy === "private_local_only"
    && item.content_status === "resolve_from_private_import"
    && Boolean(item.private_source_ref)), "DEV_HUMAN_PRIVACY_INVALID", "9 个真人案例必须只通过本地私有 importer 解析。");

  invariant(recipes.recipe_count === 9 && recipes.recipes.length === 9, "RECIPE_COUNT_INVALID", "派生配方清单必须恰好包含 9 个配方。");
  invariant(unique(recipes.recipes.map((item) => item.recipe_id)), "RECIPE_ID_DUPLICATED", "recipe_id 必须唯一。");
  invariant(unique(recipes.recipes.map((item) => item.derived_case_id)), "DERIVED_CASE_ID_DUPLICATED", "每个配方必须对应不同派生案例。");
  const humanById = new Map(devByRole.human.map((item) => [item.case_id, item]));
  const recipeById = new Map(recipes.recipes.map((item) => [item.recipe_id, item]));
  invariant(devByRole.derived.every((item) => {
    const parent = item.parent_case_id ? humanById.get(item.parent_case_id) : null;
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : null;
    return item.synthetic
      && item.privacy === "private_local_only"
      && item.content_status === "recipe_only_not_materialized"
      && parent?.source_group_id === item.source_group_id
      && recipe?.derived_case_id === item.case_id
      && recipe.parent_case_id === item.parent_case_id
      && recipe.materialized_path.includes("/.private/formal/dev28-derived/");
  }), "DERIVED_LINK_INVALID", "9 个派生案例必须一对一绑定真人父案例、配方和私有输出路径。");

  invariant(hidden.expected_case_count === 12 && hidden.slots.length === 12, "HIDDEN_COUNT_INVALID", "hidden12 必须恰好包含 12 个空槽位。");
  invariant(unique(hidden.slots.map((item) => item.slot_id)), "HIDDEN_SLOT_DUPLICATED", "hidden12 slot_id 必须唯一。");
  const hiddenReal = hidden.slots.filter((item) => item.kind === "new_private_human");
  const hiddenSynthetic = hidden.slots.filter((item) => item.kind === "post_freeze_independent_synthetic");
  invariant(hiddenReal.length === 3 && hidden.composition.new_private_human === 3, "HIDDEN_REAL_COUNT_INVALID", "hidden12 必须保留 3 个全新真人槽位。");
  invariant(hiddenSynthetic.length === 9 && hidden.composition.post_freeze_independent_synthetic === 9, "HIDDEN_SYNTHETIC_COUNT_INVALID", "hidden12 必须保留 9 个冻结后独立合成槽位。");
  invariant(hiddenReal.every((item) => item.synthetic === false), "HIDDEN_REAL_SYNTHETIC_INVALID", "真人槽位 synthetic 必须为 false。");
  invariant(hiddenSynthetic.every((item) => item.synthetic === true), "HIDDEN_SYNTHETIC_FLAG_INVALID", "合成槽位 synthetic 必须为 true。");
  const forbiddenHiddenKeys = ["transcript", "messages", "scenario", "record_cards", "daily_input", "candidate_output", "content"];
  invariant(hidden.slots.every((item) => item.content_status === "intentionally_unfilled"
    && item.source_group_id === null
    && item.materialized_path === null
    && forbiddenHiddenKeys.every((key) => !(key in item))), "HIDDEN_CONTENT_LEAK", "hidden12 正式清单只能包含空槽位，不能填入案例内容。");

  invariant(judge.packet_count === 20 && judge.slots.length === 20, "JUDGE_COUNT_INVALID", "Judge 校准清单必须恰好包含 20 个空包。");
  invariant(unique(judge.slots.map((item) => item.calibration_id)), "JUDGE_ID_DUPLICATED", "Judge calibration_id 必须唯一。");
  const judgeP0 = judge.slots.filter((item) => item.target_stratum === "p0_violation");
  const judgeClean = judge.slots.filter((item) => item.target_stratum === "clean_or_non_p0");
  invariant(judgeP0.length === 10 && judge.target_structure.p0_violation_target_slots === 10, "JUDGE_P0_COUNT_INVALID", "Judge 校准结构必须保留 10 个 P0 目标槽位。");
  invariant(judgeClean.length === 10 && judge.target_structure.clean_or_non_p0_target_slots === 10, "JUDGE_CLEAN_COUNT_INVALID", "Judge 校准结构必须保留 10 个 clean/non-P0 目标槽位。");
  invariant(judge.slots.every((item) => item.content_status === "intentionally_unfilled"
    && item.source_case_id === null
    && item.gold_label === null
    && item.materialized_path === null), "JUDGE_CONTENT_LEAK", "Judge 正式清单只能包含未填充槽位。");
  invariant(judge.gate.p0_recall_min === 1 && judge.gate.precision_min === 0.9, "JUDGE_GATE_INVALID", "Judge 门槛必须为 P0 召回 100%、精确率至少 90%。");

  return {
    total_case_count: 40,
    dev28: { seed: 10, human: 9, derived: 9 },
    hidden12: { new_human: 3, post_freeze_synthetic: 9, filled_content_count: 0 },
    derived_recipe_count: 9,
    judge_calibration_slot_count: 20
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function loadAndValidateFormalAssets(projectRoot = process.cwd()) {
  const formalRoot = resolve(projectRoot, "artifacts/journal-generation-evaluation/formal");
  const assetRoot = dirname(formalRoot);
  const [plan, dev, hidden, recipes, judge, seeds] = await Promise.all([
    readJson<EvaluationPlan>(resolve(formalRoot, "evaluation-plan.json")),
    readJson<DevManifest>(resolve(formalRoot, "dev28-manifest.json")),
    readJson<HiddenManifest>(resolve(formalRoot, "hidden12-manifest.json")),
    readJson<DerivedRecipes>(resolve(formalRoot, "derived-recipes.json")),
    readJson<JudgeManifest>(resolve(formalRoot, "judge-calibration-20-manifest.json")),
    readJson<SeedDataset>(resolve(assetRoot, "seed-cases.json"))
  ]);
  return validateFormalAssetBundle({ plan, dev, hidden, recipes, judge, seeds });
}

async function main() {
  const summary = await loadAndValidateFormalAssets();
  process.stdout.write(`${JSON.stringify({ status: "valid", ...summary })}\n`);
}

const isCli = process.argv.some(
  (argument) => basename(argument) === basename(fileURLToPath(import.meta.url))
);
if (isCli) {
  main().catch((error: unknown) => {
    const code = error instanceof FormalAssetValidationError ? error.code : "FORMAL_ASSET_VALIDATION_FAILED";
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  });
}
