import { rm } from "node:fs/promises";

import {
  loadGi088ExtensionConfirmations
} from "../../scripts/journal-generation-eval/gi088-human-extension-confirmations";
import {
  buildGi088ExtensionWritingMaterial,
  loadCommittedGi088ExtensionDailyRound
} from "../../scripts/journal-generation-eval/run-gi088-human-extension-daily";
import { createJournalExtensionFixture } from "./journal-evaluation-extension-fixture";
import { hasLocalPrivateAssets } from "../helpers/local-private-assets";

const HAS_EXTENSION_SOURCE_PACKAGE = hasLocalPrivateAssets(
  "artifacts/journal-generation-evaluation/.private/imported-manifest.json"
);

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe.skipIf(!HAS_EXTENSION_SOURCE_PACKAGE)(
  "GI-088 六条确认记录卡到 Prompt v3 今日日记",
  () => {
  it("确认原稿保留真实提问语境，编辑确认稿会让隐藏语境退出", async () => {
    const fixture = await createJournalExtensionFixture();
    cleanupDirectories.push(fixture.recordResult.outputDirectory);
    const bundle = await loadGi088ExtensionConfirmations(
      fixture.recordResult.outputDirectory,
      { allowMock: true }
    );
    const confirmation = bundle.confirmations[0];
    const source = bundle.recordRound.sourceBundle.sources[0];
    const originalMaterial = buildGi088ExtensionWritingMaterial({ confirmation, source });
    expect(originalMaterial.eventText).toBe(confirmation.approvedRecordCard.text);
    expect(originalMaterial.basedOnContentRevision).toBe(1);

    const editedMaterial = buildGi088ExtensionWritingMaterial({
      confirmation: {
        ...confirmation,
        approvedRecordCard: {
          ...confirmation.approvedRecordCard,
          text: `${confirmation.approvedRecordCard.text}（已由用户确认编辑）`
        },
        contentRevision: 2,
        edited: true
      },
      source
    });
    expect(editedMaterial.basedOnContentRevision).toBe(2);
    expect(editedMaterial.questionContext).toEqual([]);
    await fixture.cleanup();
    cleanupDirectories.pop();
  });

  it("模拟 Provider 用 6 次调用完成六篇日记，来源、Prompt 与原始响应可复核", async () => {
    const fixture = await createJournalExtensionFixture({ withDaily: true });
    if (!fixture.dailyResult) {
      throw new Error("daily fixture unavailable");
    }
    cleanupDirectories.push(
      fixture.recordResult.outputDirectory,
      fixture.dailyResult.outputDirectory
    );
    expect(fixture.dailyResult.package.run).toMatchObject({
      actual_model_calls: 6,
      technical_retries: 0,
      quality_retries: 0,
      completed_cases: 6,
      admitted_cases: 6
    });
    expect(fixture.dailyResult.package.prompt.few_shot_count).toBe(0);
    expect(fixture.dailyResult.package.cases.every((item) =>
      item.candidate.trace.attempts.every((attempt) => attempt.stage === "daily_journal")
    )).toBe(true);
    const loaded = await loadCommittedGi088ExtensionDailyRound(
      fixture.dailyResult.outputDirectory,
      fixture.recordResult.outputDirectory,
      { allowMock: true }
    );
    expect(loaded.package.execution_fingerprint)
      .toBe(fixture.dailyResult.package.execution_fingerprint);
    expect(loaded.package.parent.confirmation_set_sha256)
      .toBe(loaded.confirmations.confirmationSetSha256);
    cleanupDirectories.splice(0);
    await fixture.cleanup();
  });
  }
);
