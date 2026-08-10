"use client";

export const GI088_EVALUATION_STORAGE_VERSION =
  "2026-08-10.gi088-evaluation-client-storage-v2" as const;

const GI088_DRAFT_STORAGE_PREFIX =
  "daily-light:gi088:evaluation-draft:v8r2";

export const GI088_OUTBOX_MAP_STORAGE_KEY =
  "daily-light:gi088:evaluation-outbox-map:v8r2" as const;

export type Gi088EvaluationBranch = "off" | "high";

export type Gi088EvaluationDraftForm =
  | "chat_input"
  | "question_review_note"
  | "trajectory_review"
  | "review_revision_reason"
  | "early_stop_reason";

export type Gi088JsonValue =
  | null
  | boolean
  | number
  | string
  | Gi088JsonValue[]
  | { [key: string]: Gi088JsonValue };

export type Gi088EvaluationDraftScope = {
  runId: string;
  taskId: string | null;
  branch: Gi088EvaluationBranch | null;
  form: Gi088EvaluationDraftForm;
  turnId: string | null;
};

export type Gi088EvaluationDraftRecord<T extends Gi088JsonValue = Gi088JsonValue> = {
  version: typeof GI088_EVALUATION_STORAGE_VERSION;
  scope: Gi088EvaluationDraftScope;
  value: T;
  updatedAt: string;
};

export type Gi088EvaluationOutboxKind =
  | "start_task"
  | "turn"
  | "question_review"
  | "program_intervention_review"
  | "trajectory_review"
  | "review_revision"
  | "abort_current_task"
  | "early_stop"
  | "seal";

export type Gi088EvaluationOutboxEntry = {
  version: typeof GI088_EVALUATION_STORAGE_VERSION;
  runId: string;
  taskId: string;
  branch: Gi088EvaluationBranch;
  kind: Gi088EvaluationOutboxKind;
  clientTurnId: string;
  baseAssistantMessageId: string | null;
  content: string;
  contentHash: string;
  confirmationFingerprint: string | null;
  status: "unresolved";
  createdAt: string;
  updatedAt: string;
};

type PersistedGi088EvaluationOutboxMap = {
  version: typeof GI088_EVALUATION_STORAGE_VERSION;
  entries: Record<string, Gi088EvaluationOutboxEntry>;
};

export class Gi088EvaluationStorageError extends Error {
  constructor(readonly code: "GI088_OUTBOX_UNAVAILABLE" | "GI088_OUTBOX_WRITE_FAILED") {
    super(code);
    this.name = "Gi088EvaluationStorageError";
  }
}

type Gi088StorageDependencies = {
  storage?: Storage | null;
  now?: () => Date;
  createId?: () => string;
};

function resolveSessionStorage(storage?: Storage | null) {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function requireSessionStorage(storage?: Storage | null) {
  const resolved = resolveSessionStorage(storage);
  if (!resolved) {
    throw new Gi088EvaluationStorageError("GI088_OUTBOX_UNAVAILABLE");
  }
  return resolved;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isJsonValue(value: unknown): value is Gi088JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}

function validDraftScope(value: unknown): value is Gi088EvaluationDraftScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Partial<Gi088EvaluationDraftScope>;
  return validIdentifier(scope.runId) &&
    (scope.taskId === null || validIdentifier(scope.taskId)) &&
    (scope.branch === null || scope.branch === "off" || scope.branch === "high") &&
    (scope.form === "chat_input" ||
      scope.form === "question_review_note" ||
      scope.form === "trajectory_review" ||
      scope.form === "review_revision_reason" ||
      scope.form === "early_stop_reason") &&
    (scope.turnId === null || validIdentifier(scope.turnId));
}

function validDraftRecord(value: unknown): value is Gi088EvaluationDraftRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Gi088EvaluationDraftRecord>;
  return record.version === GI088_EVALUATION_STORAGE_VERSION &&
    validDraftScope(record.scope) &&
    isJsonValue(record.value) &&
    typeof record.updatedAt === "string";
}

function encodeKeyPart(value: string | null) {
  return encodeURIComponent(value ?? "_");
}

export function gi088EvaluationDraftStorageKey(scope: Gi088EvaluationDraftScope) {
  return [
    GI088_DRAFT_STORAGE_PREFIX,
    encodeKeyPart(scope.runId),
    encodeKeyPart(scope.taskId),
    encodeKeyPart(scope.branch),
    encodeKeyPart(scope.form),
    encodeKeyPart(scope.turnId)
  ].join("::");
}

export function readGi088EvaluationDraft<T extends Gi088JsonValue = Gi088JsonValue>(
  scope: Gi088EvaluationDraftScope,
  storage?: Storage | null
) {
  const target = resolveSessionStorage(storage);
  if (!target) return null;
  const key = gi088EvaluationDraftStorageKey(scope);
  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      validDraftRecord(parsed) &&
      gi088EvaluationDraftStorageKey(parsed.scope) === key
    ) {
      return parsed as Gi088EvaluationDraftRecord<T>;
    }
    target.removeItem(key);
  } catch {
    try {
      target.removeItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

export function writeGi088EvaluationDraft<T extends Gi088JsonValue>(
  scope: Gi088EvaluationDraftScope,
  value: T,
  dependencies: Pick<Gi088StorageDependencies, "storage" | "now"> = {}
) {
  const target = resolveSessionStorage(dependencies.storage);
  if (!target || !validDraftScope(scope) || !isJsonValue(value)) return false;
  const record: Gi088EvaluationDraftRecord<T> = {
    version: GI088_EVALUATION_STORAGE_VERSION,
    scope,
    value,
    updatedAt: (dependencies.now ?? (() => new Date()))().toISOString()
  };
  try {
    target.setItem(
      gi088EvaluationDraftStorageKey(scope),
      JSON.stringify(record)
    );
    return true;
  } catch {
    return false;
  }
}

export function clearGi088EvaluationDraft(
  scope: Gi088EvaluationDraftScope,
  storage?: Storage | null
) {
  const target = resolveSessionStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(gi088EvaluationDraftStorageKey(scope));
    return true;
  } catch {
    return false;
  }
}

export function clearGi088EvaluationDraftsForRun(
  runId: string,
  storage?: Storage | null
) {
  const target = resolveSessionStorage(storage);
  if (!target) return 0;
  let removed = 0;
  try {
    const keys = Array.from({ length: target.length }, (_, index) =>
      target.key(index)
    ).filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (!key.startsWith(`${GI088_DRAFT_STORAGE_PREFIX}::`)) continue;
      const raw = target.getItem(key);
      if (!raw) continue;
      try {
        const record = JSON.parse(raw) as unknown;
        if (validDraftRecord(record) && record.scope.runId === runId) {
          target.removeItem(key);
          removed += 1;
        }
      } catch {
        target.removeItem(key);
      }
    }
  } catch {
    return removed;
  }
  return removed;
}

function validOutboxKind(value: unknown): value is Gi088EvaluationOutboxKind {
  return value === "start_task" ||
    value === "turn" ||
    value === "question_review" ||
    value === "program_intervention_review" ||
    value === "trajectory_review" ||
    value === "review_revision" ||
    value === "abort_current_task" ||
    value === "early_stop" ||
    value === "seal";
}

function validOutboxEntry(value: unknown): value is Gi088EvaluationOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<Gi088EvaluationOutboxEntry>;
  return entry.version === GI088_EVALUATION_STORAGE_VERSION &&
    validIdentifier(entry.runId) &&
    validIdentifier(entry.taskId) &&
    (entry.branch === "off" || entry.branch === "high") &&
    validOutboxKind(entry.kind) &&
    validIdentifier(entry.clientTurnId) &&
    (entry.baseAssistantMessageId === null ||
      validIdentifier(entry.baseAssistantMessageId)) &&
    typeof entry.content === "string" &&
    /^[a-f0-9]{64}$/u.test(entry.contentHash ?? "") &&
    (entry.confirmationFingerprint === null ||
      validIdentifier(entry.confirmationFingerprint)) &&
    entry.status === "unresolved" &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string";
}

function outboxEntryKey(entry: Pick<
  Gi088EvaluationOutboxEntry,
  "runId" | "taskId" | "branch" | "kind" | "clientTurnId"
>) {
  return [
    entry.runId,
    entry.taskId,
    entry.branch,
    entry.kind,
    entry.clientTurnId
  ].map(encodeURIComponent).join("::");
}

function emptyOutboxMap(): PersistedGi088EvaluationOutboxMap {
  return {
    version: GI088_EVALUATION_STORAGE_VERSION,
    entries: {}
  };
}

function readPersistedOutboxMap(storage?: Storage | null) {
  const target = resolveSessionStorage(storage);
  if (!target) return emptyOutboxMap();
  try {
    const raw = target.getItem(GI088_OUTBOX_MAP_STORAGE_KEY);
    if (!raw) return emptyOutboxMap();
    const parsed = JSON.parse(raw) as Partial<PersistedGi088EvaluationOutboxMap>;
    if (
      parsed.version !== GI088_EVALUATION_STORAGE_VERSION ||
      !parsed.entries ||
      typeof parsed.entries !== "object"
    ) {
      target.removeItem(GI088_OUTBOX_MAP_STORAGE_KEY);
      return emptyOutboxMap();
    }
    const entries = Object.fromEntries(
      Object.values(parsed.entries)
        .filter(validOutboxEntry)
        .map((entry) => [outboxEntryKey(entry), entry])
    );
    return {
      version: GI088_EVALUATION_STORAGE_VERSION,
      entries
    } satisfies PersistedGi088EvaluationOutboxMap;
  } catch {
    try {
      target.removeItem(GI088_OUTBOX_MAP_STORAGE_KEY);
    } catch {
      return emptyOutboxMap();
    }
    return emptyOutboxMap();
  }
}

function writePersistedOutboxMap(
  value: PersistedGi088EvaluationOutboxMap,
  storage?: Storage | null
) {
  const target = requireSessionStorage(storage);
  try {
    if (Object.keys(value.entries).length === 0) {
      target.removeItem(GI088_OUTBOX_MAP_STORAGE_KEY);
    } else {
      target.setItem(GI088_OUTBOX_MAP_STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    throw new Gi088EvaluationStorageError("GI088_OUTBOX_WRITE_FAILED");
  }
}

export function readGi088EvaluationOutboxMap(storage?: Storage | null) {
  return new Map(
    Object.entries(readPersistedOutboxMap(storage).entries)
  );
}

export function listGi088EvaluationOutboxEntries(storage?: Storage | null) {
  return [...readGi088EvaluationOutboxMap(storage).values()];
}

export async function createGi088EvaluationContentHash(content: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Gi088EvaluationStorageError("GI088_OUTBOX_UNAVAILABLE");
  }
  const bytes = new TextEncoder().encode(content.trim());
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createClientTurnId(factory?: () => string) {
  if (factory) return factory();
  const random = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `gi088-turn-${random}`;
}

export async function prepareGi088EvaluationOutbox(
  input: {
    runId: string;
    taskId: string;
    branch: Gi088EvaluationBranch;
    kind: Gi088EvaluationOutboxKind;
    baseAssistantMessageId: string | null;
    content: string;
    confirmationFingerprint?: string | null;
  },
  dependencies: Gi088StorageDependencies = {}
) {
  const target = requireSessionStorage(dependencies.storage);
  const normalizedContent = input.content.trim();
  const contentHash = await createGi088EvaluationContentHash(normalizedContent);
  const confirmationFingerprint = input.confirmationFingerprint ?? null;
  const persisted = readPersistedOutboxMap(target);
  const existing = Object.values(persisted.entries).find((entry) =>
    entry.status === "unresolved" &&
    entry.runId === input.runId &&
    entry.taskId === input.taskId &&
    entry.branch === input.branch &&
    entry.kind === input.kind &&
    entry.baseAssistantMessageId === input.baseAssistantMessageId &&
    entry.contentHash === contentHash &&
    entry.confirmationFingerprint === confirmationFingerprint
  );
  if (existing) return existing;

  for (const [key, entry] of Object.entries(persisted.entries)) {
    if (
      entry.status === "unresolved" &&
      entry.runId === input.runId &&
      entry.taskId === input.taskId &&
      entry.branch === input.branch &&
      entry.kind === input.kind
    ) {
      delete persisted.entries[key];
    }
  }

  const timestamp = (dependencies.now ?? (() => new Date()))().toISOString();
  const entry: Gi088EvaluationOutboxEntry = {
    version: GI088_EVALUATION_STORAGE_VERSION,
    runId: input.runId,
    taskId: input.taskId,
    branch: input.branch,
    kind: input.kind,
    clientTurnId: createClientTurnId(dependencies.createId),
    baseAssistantMessageId: input.baseAssistantMessageId,
    content: normalizedContent,
    contentHash,
    confirmationFingerprint,
    status: "unresolved",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  persisted.entries[outboxEntryKey(entry)] = entry;
  writePersistedOutboxMap(persisted, target);
  return entry;
}

export function clearGi088EvaluationOutbox(
  input: Pick<
    Gi088EvaluationOutboxEntry,
    "runId" | "taskId" | "branch" | "kind" | "clientTurnId"
  >,
  storage?: Storage | null
) {
  const target = requireSessionStorage(storage);
  const persisted = readPersistedOutboxMap(target);
  const key = outboxEntryKey(input);
  if (!persisted.entries[key]) return false;
  delete persisted.entries[key];
  writePersistedOutboxMap(persisted, target);
  return true;
}

export function clearGi088EvaluationOutboxesForRun(
  runId: string,
  storage?: Storage | null
) {
  const target = requireSessionStorage(storage);
  const persisted = readPersistedOutboxMap(target);
  let removed = 0;
  for (const [key, entry] of Object.entries(persisted.entries)) {
    if (entry.runId !== runId) continue;
    delete persisted.entries[key];
    removed += 1;
  }
  if (removed > 0) writePersistedOutboxMap(persisted, target);
  return removed;
}
