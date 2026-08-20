const {
  listJournalGoldenSetV2CaseMetadata,
  readJournalGoldenSetV2CaseDetail
} = vi.hoisted(() => ({
  listJournalGoldenSetV2CaseMetadata: vi.fn(),
  readJournalGoldenSetV2CaseDetail: vi.fn()
}));

vi.mock("@/server/repositories/journal-golden-set.repository", async () => {
  const actual = await vi.importActual<typeof import("@/server/repositories/journal-golden-set.repository")>(
    "@/server/repositories/journal-golden-set.repository"
  );
  return {
    ...actual,
    listJournalGoldenSetV2CaseMetadata,
    readJournalGoldenSetV2CaseDetail
  };
});

import { JournalGoldenSetV2RepositoryError } from "@/server/repositories/journal-golden-set.repository";
import type { GoldenSetV2AuthorizedSource } from "@/features/journal-evaluation/golden-set-v2-contract";
import {
  GOLDEN_SET_V2_AUTHORIZED_SOURCES_ENV,
  parseJournalGoldenSetV2AuthorizedSources,
  type JournalGoldenSetV2AuthorizationProvider
} from "@/server/services/journal-evaluation/journal-golden-set-v2-authorization.provider";
import {
  getJournalGoldenSetV2CaseDetail,
  getJournalGoldenSetV2CaseShortlist,
  isJournalGoldenSetV2ContentAccessEnabled,
  JournalGoldenSetV2ServiceError
} from "@/server/services/journal-evaluation/journal-golden-set-v2.service";

const CASE_ID = "jgv2_123e4567e89b42d3a456426614174000";
const AUTHORIZATION_ID = "jgvauth_223e4567e89b42d3a456426614174000";
const NOW = new Date("2026-08-19T09:00:00.000Z");

function authorizedSource() {
  return {
    caseId: CASE_ID,
    authorization: {
      schemaVersion: "2.0" as const,
      authorizationId: AUTHORIZATION_ID,
      caseId: CASE_ID,
      privateSubjectRef: "user-1",
      accountClass: "internal" as const,
      scope: "full_trajectory_review" as const,
      externalModelProcessingAllowed: false as const,
      consentPolicyVersion: "2026-07-19",
      consentAt: "2026-08-18T08:00:00.000Z",
      consentCheckedAt: "2026-08-19T08:00:00.000Z",
      authorizedAt: "2026-08-19T08:01:00.000Z",
      authorizedBy: "product-owner",
      expiresAt: null,
      withdrawnAt: null
    },
    source: {
      rootSessionRef: "root-private-1",
      userIdRef: "user-1",
      username: "internal_capture",
      entryDate: "2026-08-19",
      recordMode: "capture" as const
    }
  };
}

function provider(
  sources: GoldenSetV2AuthorizedSource[]
): JournalGoldenSetV2AuthorizationProvider {
  return { listAuthorizedSources: () => sources };
}

describe("journal Golden Set v2 service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    delete process.env[GOLDEN_SET_V2_AUTHORIZED_SOURCES_ENV];
    delete process.env.GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED;
  });

  it("fails closed to an empty metadata shortlist when the sample mapping is absent", async () => {
    await expect(getJournalGoldenSetV2CaseShortlist({})).resolves.toEqual({
      contractVersion: "2.0",
      contentIncluded: false,
      cases: [],
      nextCursor: null
    });
    expect(listJournalGoldenSetV2CaseMetadata).not.toHaveBeenCalled();
  });

  it("parses only a strict, unique, maximum-30 private authorization mapping", () => {
    const source = authorizedSource();
    expect(parseJournalGoldenSetV2AuthorizedSources(JSON.stringify([source]))).toEqual([source]);
    expect(parseJournalGoldenSetV2AuthorizedSources("not-json")).toEqual([]);
    expect(parseJournalGoldenSetV2AuthorizedSources(JSON.stringify([source, source]))).toEqual([]);
    expect(parseJournalGoldenSetV2AuthorizedSources(JSON.stringify([
      {
        ...source,
        authorization: {
          ...source.authorization,
          externalModelProcessingAllowed: true
        }
      }
    ]))).toEqual([]);
  });

  it("forwards only authorized sources and resolves an opaque cursor server-side", async () => {
    const source = authorizedSource();
    listJournalGoldenSetV2CaseMetadata.mockResolvedValue({
      cases: [{ caseId: CASE_ID }],
      nextCursor: CASE_ID
    });

    const result = await getJournalGoldenSetV2CaseShortlist(
      { limit: 12, cursor: CASE_ID, recordMode: "capture" },
      { authorizationProvider: provider([source]), now: () => NOW }
    );

    expect(listJournalGoldenSetV2CaseMetadata).toHaveBeenCalledWith({
      limit: 12,
      recordMode: "capture",
      authorizedSources: [source],
      cursorRootSessionRef: "root-private-1",
      checkedAt: NOW
    });
    expect(JSON.stringify(result)).not.toContain("root-private-1");
  });

  it("rejects invalid shortlist limits and unknown opaque cursors", async () => {
    await expect(getJournalGoldenSetV2CaseShortlist({ limit: 0 })).rejects.toMatchObject({
      code: "JOURNAL_GOLDEN_SET_V2_INVALID_QUERY"
    });
    await expect(getJournalGoldenSetV2CaseShortlist(
      { cursor: "jgv2_323e4567e89b42d3a456426614174000" },
      { authorizationProvider: provider([authorizedSource()]), now: () => NOW }
    )).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_INVALID_QUERY" });
  });

  it("requires the exact independent content switch and returns a uniform 404", async () => {
    vi.stubEnv("GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED", "TRUE");

    expect(isJournalGoldenSetV2ContentAccessEnabled()).toBe(false);
    await expect(getJournalGoldenSetV2CaseDetail(
      { caseId: CASE_ID, adminUsername: "admin" },
      { authorizationProvider: provider([authorizedSource()]), now: () => NOW }
    )).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    expect(readJournalGoldenSetV2CaseDetail).not.toHaveBeenCalled();
  });

  it("reads one sample-authorized case and preserves the uniform repository 404", async () => {
    const source = authorizedSource();
    vi.stubEnv("GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED", "true");
    readJournalGoldenSetV2CaseDetail.mockResolvedValueOnce({
      caseId: CASE_ID,
      contentIncluded: true
    });

    await expect(getJournalGoldenSetV2CaseDetail(
      { caseId: CASE_ID, adminUsername: "admin" },
      { authorizationProvider: provider([source]), now: () => NOW }
    )).resolves.toEqual({ caseId: CASE_ID, contentIncluded: true });
    expect(readJournalGoldenSetV2CaseDetail).toHaveBeenCalledWith({
      authorizedSource: source,
      adminUsername: "admin"
    });

    readJournalGoldenSetV2CaseDetail.mockRejectedValueOnce(
      new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND")
    );
    await expect(getJournalGoldenSetV2CaseDetail(
      { caseId: CASE_ID, adminUsername: "admin" },
      { authorizationProvider: provider([source]), now: () => NOW }
    )).rejects.toEqual(
      expect.objectContaining<Partial<JournalGoldenSetV2ServiceError>>({
        code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
      })
    );
  });

  it("returns 404 without a repository read for missing, withdrawn, or expired mappings", async () => {
    vi.stubEnv("GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED", "true");
    const source = authorizedSource();

    await expect(getJournalGoldenSetV2CaseDetail(
      { caseId: CASE_ID, adminUsername: "admin" },
      { authorizationProvider: provider([]), now: () => NOW }
    )).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    await expect(getJournalGoldenSetV2CaseDetail(
      { caseId: CASE_ID, adminUsername: "admin" },
      {
        authorizationProvider: provider([{
          ...source,
          authorization: { ...source.authorization, withdrawnAt: "2026-08-19T08:30:00.000Z" }
        }]),
        now: () => NOW
      }
    )).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    await expect(getJournalGoldenSetV2CaseDetail(
      { caseId: CASE_ID, adminUsername: "admin" },
      {
        authorizationProvider: provider([{
          ...source,
          authorization: { ...source.authorization, expiresAt: "2026-08-19T08:30:00.000Z" }
        }]),
        now: () => NOW
      }
    )).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    expect(readJournalGoldenSetV2CaseDetail).not.toHaveBeenCalled();
  });
});
