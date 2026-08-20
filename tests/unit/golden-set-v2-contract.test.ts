import {
  createGoldenSetV2AuthorizationId,
  createGoldenSetV2CaseId,
  deriveGoldenSetV2Verdict,
  evaluateGoldenSetV2ProductGate,
  goldenSetV2AuthorizedSourceCollectionSchema,
  goldenSetV2AuthorizationSchema,
  goldenSetV2PrivateCaseSchema,
  goldenSetV2PublicMetadataDistributionSchema,
  goldenSetV2ReviewSchema,
  isGoldenSetV2AuthorizedSourceActive,
  reconcileGoldenSetV2Authorization,
  type GoldenSetV2CheckpointDecision,
  type GoldenSetV2CurrentConsentSnapshot,
  type GoldenSetV2DimensionScores
} from "@/features/journal-evaluation/golden-set-v2-contract";

const UUID_ONE = "123e4567-e89b-42d3-a456-426614174000";
const UUID_TWO = "223e4567-e89b-42d3-a456-426614174000";
const CASE_ID = createGoldenSetV2CaseId(() => UUID_ONE);
const AUTHORIZATION_ID = createGoldenSetV2AuthorizationId(() => UUID_TWO);
const SHA = "a".repeat(64);

const passingScores: GoldenSetV2DimensionScores = {
  factual_fidelity: 2,
  important_content_coverage: 2,
  source_and_date_boundary: 2,
  structure_and_readability: 2,
  user_voice_preservation: 2,
  update_and_manual_edit_protection: "N/A"
};

const authorization = goldenSetV2AuthorizationSchema.parse({
  schemaVersion: "2.0",
  authorizationId: AUTHORIZATION_ID,
  caseId: CASE_ID,
  privateSubjectRef: "private-user-ref",
  accountClass: "internal",
  scope: "full_trajectory_review",
  externalModelProcessingAllowed: false,
  consentPolicyVersion: "2026-07-19",
  consentAt: "2026-08-18T08:00:00.000Z",
  consentCheckedAt: "2026-08-19T08:00:00.000Z",
  authorizedAt: "2026-08-19T08:01:00.000Z",
  authorizedBy: "product-owner",
  expiresAt: null,
  withdrawnAt: null
});

const currentConsent: GoldenSetV2CurrentConsentSnapshot = {
  privateSubjectRef: "private-user-ref",
  subjectExists: true,
  policyVersion: "2026-07-19",
  consentAt: "2026-08-18T08:00:00.000Z",
  revokedAt: null,
  checkedAt: "2026-08-19T09:00:00.000Z"
};

function checkpoint(
  checkpointNumber: 10 | 30,
  decision: "approved" | "rejected" = "approved"
): GoldenSetV2CheckpointDecision {
  return {
    checkpoint: checkpointNumber,
    decision,
    decidedByRole: "product_owner",
    decidedByRef: "product-owner",
    decidedAt: "2026-08-19T10:00:00.000Z",
    reason: `checkpoint-${checkpointNumber}`
  };
}

describe("Golden Set v2 contract", () => {
  it("creates opaque random identifiers without source material", () => {
    expect(CASE_ID).toBe("jgv2_123e4567e89b42d3a456426614174000");
    expect(AUTHORIZATION_ID).toBe("jgvauth_223e4567e89b42d3a456426614174000");
    expect(CASE_ID).not.toContain("private-user-ref");
    expect(() => createGoldenSetV2CaseId(() => "user-1")).toThrow();
  });

  it("binds each opaque case to one internal source and one sample authorization", () => {
    const mapping = {
      caseId: CASE_ID,
      authorization,
      source: {
        rootSessionRef: "private-root-session",
        userIdRef: "private-user-ref",
        username: "internal_capture",
        entryDate: "2026-08-19",
        recordMode: "capture"
      }
    };
    expect(goldenSetV2AuthorizedSourceCollectionSchema.safeParse([mapping]).success).toBe(true);
    expect(goldenSetV2AuthorizedSourceCollectionSchema.safeParse([
      mapping,
      { ...mapping, source: { ...mapping.source, rootSessionRef: "another-root" } }
    ]).success).toBe(false);
    expect(goldenSetV2AuthorizedSourceCollectionSchema.safeParse([{
      ...mapping,
      source: { ...mapping.source, userIdRef: "another-user" }
    }]).success).toBe(false);
  });

  it("requires a complete event-centered chain envelope and unique source refs", () => {
    const valid = {
      schemaVersion: "2.0",
      caseId: CASE_ID,
      caseVersion: "1",
      authorizationId: AUTHORIZATION_ID,
      sourceType: "authorized_real",
      recordMode: "capture",
      entryDate: "2026-08-19",
      privateSourceRefs: {
        rootSessionRef: "session-private",
        userTurnRefs: ["turn-private"],
        eventEntryRefs: ["event-entry-private"],
        dailyEntryRef: "daily-entry-private"
      },
      sourceSha256: SHA,
      contentBundleSha256: "b".repeat(64),
      specialBehaviors: ["manual_edit_preserved"],
      status: "candidate",
      createdAt: "2026-08-19T09:00:00.000Z",
      updatedAt: "2026-08-19T09:00:00.000Z"
    };

    expect(goldenSetV2PrivateCaseSchema.safeParse(valid).success).toBe(true);
    expect(goldenSetV2PrivateCaseSchema.safeParse({
      ...valid,
      privateSourceRefs: { ...valid.privateSourceRefs, eventEntryRefs: [] }
    }).success).toBe(false);
    expect(goldenSetV2PrivateCaseSchema.safeParse({
      ...valid,
      privateSourceRefs: { ...valid.privateSourceRefs, userTurnRefs: ["turn-private", "turn-private"] }
    }).success).toBe(false);
  });

  it("enforces six 2/1/0/N/A scores, N/A reasons, blockers, and derived verdicts", () => {
    const review = {
      schemaVersion: "2.0",
      reviewId: "review-1",
      caseId: CASE_ID,
      caseContentSha256: SHA,
      reviewerRole: "codex",
      reviewerRef: "reviewer-local",
      reviewedAt: "2026-08-19T09:00:00.000Z",
      scores: passingScores,
      naReasons: {
        update_and_manual_edit_protection: "This case contains no update or manual edit."
      },
      blockers: [],
      verdict: "pass",
      rationale: "All applicable dimensions passed."
    };

    expect(goldenSetV2ReviewSchema.safeParse(review).success).toBe(true);
    expect(goldenSetV2ReviewSchema.safeParse({ ...review, naReasons: {} }).success).toBe(false);
    expect(goldenSetV2ReviewSchema.safeParse({
      ...review,
      blockers: ["privacy_leak"],
      verdict: "pass"
    }).success).toBe(false);
    expect(deriveGoldenSetV2Verdict(
      { ...passingScores, structure_and_readability: 1 },
      []
    )).toBe("minor");
    expect(deriveGoldenSetV2Verdict(passingScores, ["fabricated_fact"])).toBe("fail");
  });

  it("allows content access only while sample authorization and current consent remain valid", () => {
    expect(reconcileGoldenSetV2Authorization({ authorization, currentConsent })).toMatchObject({
      status: "eligible",
      reasons: [],
      actions: {
        contentReadAllowed: true,
        includeInActiveSet: true,
        quarantinePrivateContent: false,
        retainPublicReceiptOnly: false,
        replacementRequired: false
      }
    });

    const withdrawn = reconcileGoldenSetV2Authorization({
      authorization,
      currentConsent: {
        ...currentConsent,
        revokedAt: "2026-08-19T08:30:00.000Z"
      }
    });
    expect(withdrawn).toMatchObject({
      status: "withdrawn",
      reasons: ["consent_revoked"],
      actions: {
        contentReadAllowed: false,
        includeInActiveSet: false,
        quarantinePrivateContent: true,
        retainPublicReceiptOnly: true,
        replacementRequired: true
      }
    });

    const mismatched = reconcileGoldenSetV2Authorization({
      authorization,
      currentConsent: { ...currentConsent, privateSubjectRef: "another-private-user" }
    });
    expect(mismatched.status).toBe("quarantined");
    expect(mismatched.reasons).toContain("subject_reference_mismatch");
  });

  it("keeps a future-dated sample authorization inactive until its authorized time", () => {
    const futureAuthorization = {
      ...authorization,
      authorizedAt: "2026-08-19T10:00:00.000Z"
    };
    const mapping = {
      caseId: CASE_ID,
      authorization: futureAuthorization,
      source: {
        rootSessionRef: "private-root-session",
        userIdRef: "private-user-ref",
        username: "internal_capture",
        entryDate: "2026-08-19",
        recordMode: "capture" as const
      }
    };

    expect(isGoldenSetV2AuthorizedSourceActive(
      mapping,
      new Date("2026-08-19T09:00:00.000Z")
    )).toBe(false);
    expect(reconcileGoldenSetV2Authorization({
      authorization: futureAuthorization,
      currentConsent
    })).toMatchObject({
      status: "quarantined",
      reasons: ["sample_authorization_not_started"],
      actions: { contentReadAllowed: false }
    });
  });

  it("fails closed for deleted accounts, expired authorization, and policy-version changes", () => {
    const deleted = reconcileGoldenSetV2Authorization({
      authorization,
      currentConsent: {
        privateSubjectRef: "private-user-ref",
        subjectExists: false,
        policyVersion: null,
        consentAt: null,
        revokedAt: null,
        checkedAt: "2026-08-19T09:00:00.000Z"
      }
    });
    expect(deleted.status).toBe("withdrawn");
    expect(deleted.reasons).toEqual(["account_deleted"]);

    const expiredAuthorization = {
      ...authorization,
      expiresAt: "2026-08-19T08:30:00.000Z"
    };
    const expired = reconcileGoldenSetV2Authorization({
      authorization: expiredAuthorization,
      currentConsent
    });
    expect(expired.reasons).toContain("sample_authorization_expired");

    const policyChanged = reconcileGoldenSetV2Authorization({
      authorization,
      currentConsent: { ...currentConsent, policyVersion: "2026-08-20" }
    });
    expect(policyChanged.status).toBe("quarantined");
    expect(policyChanged.reasons).toContain("consent_version_changed");

    const reconsented = reconcileGoldenSetV2Authorization({
      authorization,
      currentConsent: {
        ...currentConsent,
        consentAt: "2026-08-19T08:45:00.000Z"
      }
    });
    expect(reconsented.status).toBe("quarantined");
    expect(reconsented.reasons).toContain("consent_epoch_changed");
  });

  it("keeps the 10/30 corpus checkpoints separate from single-case quality blockers", () => {
    expect(evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 9,
      reviewedCaseCount: 9,
      unresolvedReconciliationCount: 0,
      singleCaseBlockerCount: 0,
      checkpointDecisions: []
    })).toMatchObject({ corpusStatus: "collecting_to_10", nextCheckpoint: 10 });

    expect(evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 10,
      reviewedCaseCount: 10,
      unresolvedReconciliationCount: 0,
      singleCaseBlockerCount: 0,
      checkpointDecisions: []
    })).toMatchObject({ corpusStatus: "awaiting_product_checkpoint_10", nextCheckpoint: 10 });

    expect(evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 30,
      reviewedCaseCount: 30,
      unresolvedReconciliationCount: 0,
      singleCaseBlockerCount: 1,
      checkpointDecisions: [checkpoint(10), checkpoint(30)]
    })).toEqual({
      corpusStatus: "ready_to_seal",
      corpusReadyToSeal: true,
      productQualityStatus: "blocked_by_single_case",
      nextCheckpoint: null
    });

    expect(evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 30,
      reviewedCaseCount: 30,
      unresolvedReconciliationCount: 1,
      singleCaseBlockerCount: 0,
      checkpointDecisions: [checkpoint(10), checkpoint(30)]
    }).corpusStatus).toBe("reconciliation_required");
  });

  it("rejects early, duplicate, and out-of-order product checkpoint decisions", () => {
    expect(() => evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 10,
      reviewedCaseCount: 9,
      unresolvedReconciliationCount: 0,
      singleCaseBlockerCount: 0,
      checkpointDecisions: [checkpoint(10)]
    })).toThrow();
    expect(() => evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 30,
      reviewedCaseCount: 30,
      unresolvedReconciliationCount: 0,
      singleCaseBlockerCount: 0,
      checkpointDecisions: [checkpoint(10), checkpoint(10)]
    })).toThrow();
    expect(() => evaluateGoldenSetV2ProductGate({
      eligibleCaseCount: 30,
      reviewedCaseCount: 30,
      unresolvedReconciliationCount: 0,
      singleCaseBlockerCount: 0,
      checkpointDecisions: [checkpoint(30)]
    })).toThrow();
  });

  it("enforces daily small-cell suppression in public metadata", () => {
    expect(goldenSetV2PublicMetadataDistributionSchema.safeParse({
      privacyThreshold: 3,
      byDay: [],
      suppressedDayBucketCount: 1,
      byMonth: [
        { month: "2026-08", total: 1, internal: 0, capture: 0, chat: 1 }
      ]
    }).success).toBe(true);
    expect(goldenSetV2PublicMetadataDistributionSchema.safeParse({
      privacyThreshold: 3,
      byDay: [
        { day: "2026-08-13", total: 1, internal: 0, capture: 0, chat: 1 }
      ],
      suppressedDayBucketCount: 0,
      byMonth: []
    }).success).toBe(false);
  });
});
