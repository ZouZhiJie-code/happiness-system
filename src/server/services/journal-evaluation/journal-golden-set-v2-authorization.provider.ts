import {
  goldenSetV2AuthorizedSourceCollectionSchema,
  type GoldenSetV2AuthorizedSource
} from "@/features/journal-evaluation/golden-set-v2-contract";

export const GOLDEN_SET_V2_AUTHORIZED_SOURCES_ENV =
  "GOLDEN_SET_V2_AUTHORIZED_SOURCES_JSON" as const;

const MAX_AUTHORIZED_SOURCES_JSON_BYTES = 64 * 1024;

export interface JournalGoldenSetV2AuthorizationProvider {
  listAuthorizedSources():
    | readonly GoldenSetV2AuthorizedSource[]
    | Promise<readonly GoldenSetV2AuthorizedSource[]>;
}

/**
 * The environment mapping is a private, server-only capability list. Any
 * missing, malformed, duplicate, oversized, or contract-invalid mapping fails
 * closed to an empty list.
 */
export function parseJournalGoldenSetV2AuthorizedSources(
  raw = process.env[GOLDEN_SET_V2_AUTHORIZED_SOURCES_ENV] ?? ""
): GoldenSetV2AuthorizedSource[] {
  const normalized = raw.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > MAX_AUTHORIZED_SOURCES_JSON_BYTES) {
    return [];
  }

  try {
    const parsed = goldenSetV2AuthorizedSourceCollectionSchema.safeParse(JSON.parse(normalized));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export const environmentJournalGoldenSetV2AuthorizationProvider:
JournalGoldenSetV2AuthorizationProvider = {
  listAuthorizedSources: () => parseJournalGoldenSetV2AuthorizedSources()
};
