import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  loadAndValidateFormalAssets,
  validateFormalAssetBundle
} from "../../scripts/journal-generation-eval/formal-asset-validator";

describe("journal generation formal evaluation assets", () => {
  it("固定 dev28、hidden12、9 派生配方与 Judge20 的结构口径", async () => {
    await expect(loadAndValidateFormalAssets()).resolves.toEqual({
      total_case_count: 40,
      dev28: { seed: 10, human: 9, derived: 9 },
      hidden12: { new_human: 3, post_freeze_synthetic: 9, filled_content_count: 0 },
      derived_recipe_count: 9,
      judge_calibration_slot_count: 20
    });
  });

  it("hidden12 正式清单只含空槽位且不填造隐藏内容", async () => {
    const hidden = JSON.parse(await readFile(
      resolve(process.cwd(), "artifacts/journal-generation-evaluation/formal/hidden12-manifest.json"),
      "utf8"
    )) as { slots: Array<Record<string, unknown>> };
    const serialized = JSON.stringify(hidden.slots);

    expect(hidden.slots).toHaveLength(12);
    expect(hidden.slots.every((slot) => slot.content_status === "intentionally_unfilled")).toBe(true);
    expect(hidden.slots.every((slot) => slot.source_group_id === null)).toBe(true);
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("record_cards");
    expect(serialized).not.toContain("daily_input");
    expect(serialized).not.toContain("candidate_output");
  });

  it("结构校验会拒绝把 hidden 槽位提前填充", async () => {
    const formalRoot = resolve(process.cwd(), "artifacts/journal-generation-evaluation/formal");
    const assetRoot = resolve(process.cwd(), "artifacts/journal-generation-evaluation");
    const [plan, dev, hidden, recipes, judge, seeds] = await Promise.all([
      readFile(resolve(formalRoot, "evaluation-plan.json"), "utf8").then(JSON.parse),
      readFile(resolve(formalRoot, "dev28-manifest.json"), "utf8").then(JSON.parse),
      readFile(resolve(formalRoot, "hidden12-manifest.json"), "utf8").then(JSON.parse),
      readFile(resolve(formalRoot, "derived-recipes.json"), "utf8").then(JSON.parse),
      readFile(resolve(formalRoot, "judge-calibration-20-manifest.json"), "utf8").then(JSON.parse),
      readFile(resolve(assetRoot, "seed-cases.json"), "utf8").then(JSON.parse)
    ]);
    hidden.slots[0] = { ...hidden.slots[0], content: "提前泄漏的隐藏内容" };

    expect(() => validateFormalAssetBundle({ plan, dev, hidden, recipes, judge, seeds }))
      .toThrowError(/hidden12 正式清单只能包含空槽位/u);
  });
});
