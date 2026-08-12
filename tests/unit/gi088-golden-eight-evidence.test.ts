import { describe, expect, it } from "vitest";

import {
  createGi088DatasetFingerprint,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExperienceFingerprint,
  createGi088FingerprintBundle,
  createGi088RunnerFingerprint
} from "@/server/services/evaluation/gi088/candidate";
import { GI088_GOLDEN_EIGHT_REPLACEMENT_EVIDENCE } from "@/server/services/evaluation/gi088/golden-eight-evidence";

describe("GI-088 Golden 8 evidence binding", () => {
  it("matches the sealed redacted receipt and keeps private content out of runtime", () => {
    expect(GI088_GOLDEN_EIGHT_REPLACEMENT_EVIDENCE).toEqual({
      version: "2026-08-11.gi088-v8r3-golden-replacements-v1",
      sourceSha256:
        "93aeb1dbdce10964ad24d8ff5a197d4655463527052b8254e95eb36dba6bb973",
      decisionsSha256:
        "86b91697d833fe239b0946a436c048d311958313cc01323b1901ba80d835cb7f",
      receiptFileSha256:
        "fcfce1e4b131f657266bc1731842a976e18e4bacc0ba09b9f6da0568a53bb6e2",
      cardCount: 8,
      decisionCount: 8,
      carryForwardCount: 32,
      readyToUseCount: 7,
      qualityFailureCount: 1,
      singleBlockerCount: 0,
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0
    });
    expect(JSON.stringify(GI088_GOLDEN_EIGHT_REPLACEMENT_EVIDENCE)).not.toMatch(
      /重复|丢脸|用户|候选回应/
    );
  });

  it("binds the evidence to every current release layer", () => {
    const bundle = createGi088FingerprintBundle();
    for (const fingerprint of [
      bundle.candidateFingerprint,
      bundle.datasetFingerprint,
      bundle.runnerFingerprint,
      bundle.experienceFingerprint,
      bundle.executionFingerprint
    ]) {
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(createGi088EffectiveCandidateFingerprint()).toBe(
      bundle.candidateFingerprint
    );
    expect(createGi088DatasetFingerprint()).toBe(bundle.datasetFingerprint);
    expect(createGi088RunnerFingerprint()).toBe(bundle.runnerFingerprint);
    expect(createGi088ExperienceFingerprint()).toBe(bundle.experienceFingerprint);
  });
});
