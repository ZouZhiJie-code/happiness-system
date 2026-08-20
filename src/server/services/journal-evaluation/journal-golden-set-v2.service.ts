import { z } from "zod";

import {
  goldenSetV2AuthorizedSourceCollectionSchema,
  goldenSetV2CaseIdSchema,
  isGoldenSetV2AuthorizedSourceActive,
  type GoldenSetV2AuthorizedSource
} from "@/features/journal-evaluation/golden-set-v2-contract";
import {
  JournalGoldenSetV2RepositoryError,
  listJournalGoldenSetV2CaseMetadata,
  readJournalGoldenSetV2CaseDetail,
  type JournalGoldenSetV2RecordMode
} from "@/server/repositories/journal-golden-set.repository";
import {
  environmentJournalGoldenSetV2AuthorizationProvider,
  type JournalGoldenSetV2AuthorizationProvider
} from "@/server/services/journal-evaluation/journal-golden-set-v2-authorization.provider";

export const JOURNAL_GOLDEN_SET_V2_CONTRACT_VERSION = "2.0" as const;

const listInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(30),
  cursor: goldenSetV2CaseIdSchema.optional(),
  recordMode: z.enum(["capture", "chat"]).optional()
}).strict();

export class JournalGoldenSetV2ServiceError extends Error {
  constructor(
    readonly code:
      | "JOURNAL_GOLDEN_SET_V2_INVALID_QUERY"
      | "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
  ) {
    super(code);
    this.name = "JournalGoldenSetV2ServiceError";
  }
}

/**
 * Content access is an explicit, independent switch. Missing, misspelled, or
 * ambiguous values all fail closed.
 */
export function isJournalGoldenSetV2ContentAccessEnabled(
  raw = process.env.GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED
) {
  return raw === "true";
}

type JournalGoldenSetV2ServiceDependencies = {
  authorizationProvider?: JournalGoldenSetV2AuthorizationProvider;
  now?: () => Date;
};

async function loadActiveAuthorizedSources(
  dependencies: JournalGoldenSetV2ServiceDependencies
): Promise<GoldenSetV2AuthorizedSource[]> {
  const provider = dependencies.authorizationProvider
    ?? environmentJournalGoldenSetV2AuthorizationProvider;
  try {
    const parsed = goldenSetV2AuthorizedSourceCollectionSchema.safeParse(
      await provider.listAuthorizedSources()
    );
    if (!parsed.success) return [];
    const checkedAt = (dependencies.now ?? (() => new Date()))();
    return parsed.data.filter((source) => isGoldenSetV2AuthorizedSourceActive(source, checkedAt));
  } catch {
    return [];
  }
}

export async function getJournalGoldenSetV2CaseShortlist(input: {
  limit?: number;
  cursor?: string;
  recordMode?: JournalGoldenSetV2RecordMode;
}, dependencies: JournalGoldenSetV2ServiceDependencies = {}) {
  const parsed = listInputSchema.safeParse({
    limit: input.limit ?? 30,
    cursor: input.cursor,
    recordMode: input.recordMode
  });
  if (!parsed.success) {
    throw new JournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_INVALID_QUERY");
  }

  const authorizedSources = await loadActiveAuthorizedSources(dependencies);
  const cursorSource = parsed.data.cursor
    ? authorizedSources.find((source) => source.caseId === parsed.data.cursor)
    : undefined;
  if (parsed.data.cursor && !cursorSource) {
    throw new JournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_INVALID_QUERY");
  }
  const result = authorizedSources.length
    ? await listJournalGoldenSetV2CaseMetadata({
        limit: parsed.data.limit,
        recordMode: parsed.data.recordMode,
        authorizedSources,
        cursorRootSessionRef: cursorSource?.source.rootSessionRef,
        checkedAt: (dependencies.now ?? (() => new Date()))()
      })
    : { cases: [], nextCursor: null };

  return {
    contractVersion: JOURNAL_GOLDEN_SET_V2_CONTRACT_VERSION,
    contentIncluded: false as const,
    cases: result.cases,
    nextCursor: result.nextCursor
  };
}

export async function getJournalGoldenSetV2CaseDetail(input: {
  caseId: string;
  adminUsername: string;
}, dependencies: JournalGoldenSetV2ServiceDependencies = {}) {
  const parsedCaseId = goldenSetV2CaseIdSchema.safeParse(input.caseId);
  if (!parsedCaseId.success) {
    throw new JournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
  }

  if (!isJournalGoldenSetV2ContentAccessEnabled()) {
    throw new JournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
  }

  const authorizedSources = await loadActiveAuthorizedSources(dependencies);
  const authorizedSource = authorizedSources.find((source) => source.caseId === parsedCaseId.data);
  if (!authorizedSource) {
    throw new JournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
  }

  try {
    return await readJournalGoldenSetV2CaseDetail({
      authorizedSource,
      adminUsername: input.adminUsername,
    });
  } catch (error) {
    if (error instanceof JournalGoldenSetV2RepositoryError) {
      throw new JournalGoldenSetV2ServiceError(error.code);
    }
    throw error;
  }
}
