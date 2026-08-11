import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGi088V8r3GoldenReplacementItems } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-replacements";
import { GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS } from "@/features/interview/event-centered/gi088-golden-revision-workbench";

describe("GI-088 v8r3 Golden 替换素材", () => {
  it("A 轮只取三条已判可直接用的真实陪聊轨迹，B 轮五条都有完整上下文", async () => {
    const root = await mkdtemp(join(tmpdir(), "gi088-golden-history-"));
    const directory = join(
      root,
      "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1"
    );
    await mkdir(directory, { recursive: true });
    const tasks = ["A3", "A5", "A8"].map((taskId, index) => ({
      taskId,
      initialUserMessage: `历史用户任务 ${taskId}`,
      branches: {
        high: {
          messages: [
            { role: "assistant", content: "此刻你想聊点什么？" },
            { role: "user", content: `用户表达 ${taskId}` },
            { role: "assistant", content: `历史陪聊回应 ${taskId}` }
          ],
          turns: [
            {
              status: "valid",
              visible: { understanding: `历史理解 ${taskId}` },
              calls: [{ status: "valid", latencyMs: 300 + index }]
            }
          ],
          semanticState: { workingTask: { summary: `历史共同任务 ${taskId}` } },
          review: { quality: "direct_use" }
        }
      }
    }));
    await writeFile(
      join(directory, "gi088-human-eval-v1-readonly-db-snapshot.json"),
      JSON.stringify({ batch: { tasks } }),
      { mode: 0o600 }
    );
    const [goldenA, goldenB] =
      await createGi088V8r3GoldenReplacementItems({
        historicalPrivateRoot: root
      });
    expect(goldenA.map((item) => item.replacesSampleId)).toEqual(
      GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA
    );
    expect(goldenB.map((item) => item.replacesSampleId)).toEqual(
      GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB
    );
    expect(goldenA).toHaveLength(3);
    expect(goldenB).toHaveLength(5);
    expect(
      goldenA.every(
        (replacement) =>
          replacement.item.checkpoints[0]!.visibleConversation.length >= 2
      )
    ).toBe(true);
    expect(
      goldenB.every(
        (replacement) =>
          replacement.item.checkpoints[0]!.visibleConversation.length >= 3
      )
    ).toBe(true);
    expect(
      new Set(
        [...goldenA, ...goldenB].map(
          (replacement) => replacement.item.contentFingerprint
        )
      ).size
    ).toBe(8);
  });
});
