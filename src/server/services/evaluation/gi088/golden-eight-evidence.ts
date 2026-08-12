/**
 * Public, redacted evidence for the product-owner's sealed Golden 8 round.
 *
 * The source cards and individual reasons stay in the local private review
 * directory.  Runtime code receives only immutable counts and digests so the
 * review can affect versioning without exposing evaluation material.
 */
export const GI088_GOLDEN_EIGHT_REPLACEMENT_EVIDENCE = {
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
} as const;

export type Gi088GoldenEightReplacementEvidence =
  typeof GI088_GOLDEN_EIGHT_REPLACEMENT_EVIDENCE;
