import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  goldenSetV2PublicManifestSchema,
  goldenSetV2PublicMetadataDistributionSchema
} from "@/features/journal-evaluation/golden-set-v2-contract";

const ASSET_ROOT = resolve(
  process.cwd(),
  "artifacts/production-evidence-hardening/2026-08-19/golden-set-v2"
);

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

describe("Golden Set v2 public assets", () => {
  it("publishes a strict zero-content, zero-call manifest bound to the contract fingerprint", async () => {
    const manifest = goldenSetV2PublicManifestSchema.parse(JSON.parse(
      await readFile(resolve(ASSET_ROOT, "manifest.json"), "utf8")
    ));
    const contract = await readFile(resolve(process.cwd(), manifest.contract.path));
    const actualSha256 = createHash("sha256").update(contract).digest("hex");

    expect(manifest.contract.sha256).toBe(actualSha256);
    expect(manifest).toMatchObject({
      status: "foundation_ready",
      counts: { candidates: 0, reviewed: 0, golden: 0, withdrawn: 0, blockers: 0 },
      cases: [],
      rawContentIncluded: false,
      productionContentReadCount: 0,
      modelCallCount: 0
    });
    const keys = collectKeys(manifest);
    for (const forbiddenKey of [
      "userId",
      "username",
      "privateSubjectRef",
      "sessionId",
      "entryDate",
      "transcript",
      "content",
      "rawResponse"
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it("keeps all private payloads ignored and only exposes the ignore policy", async () => {
    const ignorePolicy = await readFile(resolve(ASSET_ROOT, ".private/.gitignore"), "utf8");
    expect(ignorePolicy).toBe("*\n!.gitignore\n");
  });

  it("suppresses exact daily small cells and keeps the public inventory content-free", async () => {
    const inventory = JSON.parse(
      await readFile(resolve(ASSET_ROOT, "production-metadata-inventory.json"), "utf8")
    ) as Record<string, unknown>;
    expect(goldenSetV2PublicMetadataDistributionSchema.safeParse(
      inventory.distribution
    ).success).toBe(true);
    expect(inventory).toMatchObject({
      status: "insufficient_samples",
      collectionStatus: "collection_pending",
      safetyReceipt: {
        contentColumnsSelected: 0,
        productionContentReadCount: 0,
        modelCallCount: 0,
        contentAccessEnabled: false
      },
      publicEvidenceContainsUserContent: false,
      publicEvidenceContainsUserIdentity: false
    });
    const keys = collectKeys(inventory);
    for (const forbiddenKey of [
      "userId",
      "username",
      "privateSubjectRef",
      "sessionId",
      "entryDate",
      "transcript",
      "content",
      "rawResponse"
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });
});
