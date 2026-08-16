import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { AIOutputOrigin } from "@prisma/client";

import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import type {
  JournalDailyEntryRecord,
  JournalDailyEntryGenerationRecord,
  JournalDailyEntrySourceSnapshot,
  JournalDailyJournalView,
  JournalDailyParagraphDocument,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";
import type {
  JournalEventEntryRecord,
  JournalEventEntrySourceSnapshot
} from "@/types/journal-event-entry";

import {
  JOURNAL_PREVIEW_CASES,
  JOURNAL_PREVIEW_MODE,
  type JournalPreviewCaseId,
  type JournalPreviewCaseSummary,
  type JournalPreviewDailyGenerationResult,
  type JournalPreviewDayView,
  type JournalPreviewSessionView
} from "./contract";

const PRIVATE_ROOT = resolve(process.cwd(), "artifacts/journal-generation-evaluation/.private");
const DEFAULT_PACKAGE_ROOT = resolve(
  PRIVATE_ROOT,
  "formal/record-card-v3-daily"
);
const REQUIRED_CASE_IDS = new Map<JournalPreviewCaseId, string>([
  ["v6-a1", "private:sg-gi088-v6-single-focus:A1:high"],
  ["v7-a1", "private:sg-gi088-v7-continuity-baseline:A1:high"],
  ["v7-a2", "private:sg-gi088-v7-continuity-baseline:A2:high"],
  ["v7r2-a1", "private:sg-gi088-v7r2-ark-flash:A1:high"],
  ["v7r2-a2", "private:sg-gi088-v7r2-ark-flash:A2:high"],
  ["v7r4-a1", "private:sg-gi088-v7r4-pro:A1:high"]
]);

type FixturePackage = {
  round_id: string;
  execution_fingerprint: string;
  scope_fingerprint: string;
  parent?: { execution_fingerprint?: string };
  runtime?: { model?: string; thinking?: string; temperature?: number };
  cases: Array<{
    case_id: string;
    source_group_id: string;
    source_file_sha256: string;
    source_projection_sha256: string;
    approved_record_card: {
      record_card_id: string;
      event_id: string;
      title: string;
      text: string;
      insight?: string;
      source_refs: string[];
    };
    approved_record_card_sha256: string;
    source_signature: string;
    content_revision: number;
    record_card_edited: boolean;
    candidate: {
      candidate_id: string;
      title: string;
      paragraphs: Array<{
        paragraph_id: string;
        text: string;
        source_refs: string[];
        record_card_refs: string[];
      }>;
      program_check: { admitted: boolean };
      trace?: { prompt_hash?: string; raw_response_sha256?: string | null };
    };
  }>;
};

type FixtureManifest = {
  status: "committed";
  round_id: string;
  child_artifacts?: { package_sha256?: string };
  files?: { package?: string };
};

type FixtureSource = {
  snapshot: JournalEventEntrySourceSnapshot;
  sourceFileSha256: string;
  sourceProjectionSha256: string;
};

export type JournalPreviewFixture = {
  publicId: JournalPreviewCaseId;
  label: string;
  editable: boolean;
  packageCase: FixturePackage["cases"][number];
  source: FixtureSource;
  entryDate: string;
  baselineRecord: JournalEventEntryRecord;
  baselineDaily: JournalDailyEntryRecord;
  baselineDailySha256: string;
};

type MutablePreviewCase = {
  fixture: JournalPreviewFixture;
  record: JournalEventEntryRecord;
  daily: JournalDailyEntryRecord;
  latestGeneration: JournalDailyEntryGenerationRecord | null;
};

type PreviewSession = {
  id: string;
  userId: string;
  createdAt: string;
  cases: Map<JournalPreviewCaseId, MutablePreviewCase>;
};

export interface JournalPreviewFixtureLoader {
  load(): Promise<JournalPreviewFixture[]>;
}

export interface JournalPreviewServiceDependencies {
  loader?: JournalPreviewFixtureLoader;
  now?: () => Date;
  id?: () => string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function sha256Canonical(value: unknown) {
  return sha256Text(JSON.stringify(canonicalize(value)));
}

function isoAt(entryDate: string, hour = 12) {
  return new Date(`${entryDate}T${String(hour).padStart(2, "0")}:00:00+08:00`).toISOString();
}

function parseEntryDate(title: string) {
  const match = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/u);
  if (!match) throw new Error("JOURNAL_PREVIEW_ENTRY_DATE_INVALID");
  return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
}

function assertContained(path: string) {
  const fromPrivate = relative(PRIVATE_ROOT, path);
  if (!fromPrivate || fromPrivate === ".." || fromPrivate.startsWith(`..${sep}`)) {
    throw new Error("JOURNAL_PREVIEW_PRIVATE_PATH_REQUIRED");
  }
}

async function sha256File(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function findCommittedPackageDirectory() {
  const configured = process.env.JOURNAL_PREVIEW_FIXTURE_DIRECTORY?.trim();
  const root = configured ? resolve(configured) : DEFAULT_PACKAGE_ROOT;
  assertContained(root);
  const realRoot = await realpath(root).catch(() => {
    throw new Error("JOURNAL_PREVIEW_FIXTURE_PACKAGE_MISSING");
  });
  const names = (await readdir(realRoot)).filter((name) => name.startsWith("gi088-record-card-v3-daily-regression-"));
  const committed: string[] = [];
  for (const name of names) {
    const directory = resolve(realRoot, name);
    try {
      const manifest = JSON.parse(await readFile(resolve(directory, "commit-manifest.json"), "utf8")) as FixtureManifest;
      if (manifest.status === "committed" && manifest.round_id === "gi088-record-card-v3-daily-regression") {
        committed.push(directory);
      }
    } catch {
      // 未完成或格式损坏的回放目录继续保留为证据，不进入当前 Preview。
    }
  }
  if (committed.length !== 1) throw new Error("JOURNAL_PREVIEW_FIXTURE_PACKAGE_AMBIGUOUS");
  return realpath(committed[0]!);
}

async function readFixturePackage() {
  const directory = await findCommittedPackageDirectory();
  const packagePath = resolve(directory, "round-package.json");
  const manifestPath = resolve(directory, "commit-manifest.json");
  const [packageText, manifestText] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(manifestPath, "utf8")
  ]);
  const manifest = JSON.parse(manifestText) as FixtureManifest;
  if (manifest.files?.package && manifest.files.package !== "round-package.json") {
    throw new Error("JOURNAL_PREVIEW_FIXTURE_MANIFEST_INVALID");
  }
  if (manifest.child_artifacts?.package_sha256 !== await sha256File(packagePath)) {
    throw new Error("JOURNAL_PREVIEW_FIXTURE_PACKAGE_HASH_MISMATCH");
  }
  const value = JSON.parse(packageText) as FixturePackage;
  if (
    value.round_id !== "gi088-record-card-v3-daily-regression" ||
    value.cases.length !== JOURNAL_PREVIEW_CASES.length ||
    value.runtime?.model !== "deepseek-v4-flash" ||
    value.runtime?.thinking !== "disabled" ||
    value.runtime?.temperature !== 0.2
  ) {
    throw new Error("JOURNAL_PREVIEW_FIXTURE_SEMANTICS_INVALID");
  }
  return { directory, value, packageSha256: await sha256File(packagePath) };
}

async function loadSourceSnapshots(): Promise<Map<string, FixtureSource>> {
  // The source projection is loaded through the already sealed private source index.
  // Dynamic import keeps ordinary production requests from loading evaluation-only code.
  const sourceModule = await import("../../../../scripts/journal-generation-eval/gi088-human-extension-source");
  const bundle = await sourceModule.loadGi088HumanExtensionSources(process.cwd());
  return new Map(bundle.sources.map((source) => [source.selection.caseId, {
    snapshot: source.snapshot,
    sourceFileSha256: source.sourceFileSha256,
    sourceProjectionSha256: source.sourceProjectionSha256
  }]));
}

function paragraphsForCard(
  entryId: string,
  candidate: FixturePackage["cases"][number]["candidate"]
): JournalDailyParagraphDocument {
  return {
    schemaVersion: 1,
    paragraphs: candidate.paragraphs.map((paragraph) => ({
      text: paragraph.text,
      sourceRecordIds: [entryId]
    }))
  };
}

function createBaselineRecords(
  fixtureCase: FixturePackage["cases"][number],
  publicId: JournalPreviewCaseId,
  label: string,
  source: FixtureSource | null
) {
  const entryDate = parseEntryDate(fixtureCase.candidate.title);
  const createdAt = isoAt(entryDate);
  const entryId = `journal-preview:${publicId}:record`;
  const dailyId = `journal-preview:${publicId}:daily`;
  const card = fixtureCase.approved_record_card;
  const sourceSnapshot: JournalEventEntrySourceSnapshot = source?.snapshot
    ? clone({ ...source.snapshot, eventId: card.event_id })
    : {
        schemaVersion: 1,
        eventId: card.event_id,
        branchSessionId: `journal-preview:${publicId}:branch`,
        baseMessageSequence: 0,
        messages: [],
        facts: [],
        effectiveFactIds: [],
        deprioritizedFactIds: [],
        explorationFactIds: [],
        angleOutcomes: [],
        logEligibleOutcomeIds: [],
        pendingClaimConfirmation: { kind: "no_eligible_claim", claimId: null, factId: null }
      };
  const sourceMessageIds = sourceSnapshot.messages.map((message) => message.id);
  const record: JournalEventEntryRecord = {
    id: entryId,
    eventId: card.event_id,
    entryDate,
    daySequence: 1,
    sourceBranchSessionId: sourceSnapshot.branchSessionId,
    generatedByTurnId: null,
    currentGenerationTraceId: `journal-preview:${publicId}:record-trace`,
    generationId: null,
    title: card.title,
    content: card.text,
    occurredAtText: null,
    status: "saved",
    generationOrigin: "llm" as AIOutputOrigin,
    generationVersion: 3,
    sourceMessageSequence: sourceSnapshot.baseMessageSequence,
    sourceMessageIds,
    sourceFactIds: [...sourceSnapshot.effectiveFactIds],
    sourceAngleOutcomeIds: [...sourceSnapshot.logEligibleOutcomeIds],
    sourceFingerprint: fixtureCase.source_projection_sha256,
    sourceSnapshot,
    contentRevision: fixtureCase.content_revision,
    savedRevision: fixtureCase.content_revision,
    editedAt: null,
    savedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };
  const sourceEntry: JournalDailySourceEntry = {
    eventId: card.event_id,
    entryId,
    entryDate,
    daySequence: 1,
    title: card.title,
    content: card.text,
    contentRevision: fixtureCase.content_revision,
    savedRevision: fixtureCase.content_revision,
    savedAt: createdAt,
    updatedAt: createdAt,
    recordedAt: createdAt,
    occurredAt: null,
    sourceMode: "chat",
    recordCount: 1,
    sourceMessageIds
  };
  const paragraphs = paragraphsForCard(entryId, fixtureCase.candidate);
  const dailySnapshot: JournalDailyEntrySourceSnapshot = {
    schemaVersion: 2,
    entryDate,
    sources: [sourceEntry]
  };
  const daily: JournalDailyEntryRecord = {
    id: dailyId,
    entryDate,
    title: fixtureCase.candidate.title,
    content: paragraphs.paragraphs.map((paragraph) => paragraph.text).join("\n\n"),
    paragraphs,
    status: "saved",
    sourceEntryIds: [entryId],
    sourceEventIds: [card.event_id],
    sourceSignature: fixtureCase.source_signature,
    sourceSnapshot: dailySnapshot,
    sourceUpdatedAt: createdAt,
    contentRevision: 1,
    savedRevision: 1,
    currentGenerationTraceId: `journal-preview:${publicId}:daily-trace`,
    lastGenerationErrorCode: null,
    editedAt: null,
    savedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };
  return { entryDate, record, daily, entryId, dailyId, label };
}

function buildView(state: MutablePreviewCase): JournalDailyJournalView {
  const source = state.record;
  const currentSourceSignature = state.record.contentRevision === state.fixture.packageCase.content_revision
    ? state.fixture.packageCase.source_signature
    : buildJournalDailySourceSignature([{
        entryId: source.id,
        daySequence: source.daySequence,
        contentRevision: source.contentRevision
      }]);
  const sourceEntry: JournalDailySourceEntry = {
    eventId: source.eventId,
    entryId: source.id,
    entryDate: source.entryDate,
    daySequence: source.daySequence,
    title: source.title,
    content: source.content,
    contentRevision: source.contentRevision,
    savedRevision: source.savedRevision,
    savedAt: source.savedAt,
    updatedAt: source.updatedAt,
    recordedAt: source.createdAt,
    occurredAt: null,
    sourceMode: "chat",
    recordCount: 1,
    sourceMessageIds: [...source.sourceMessageIds]
  };
  const freshness = state.daily.sourceSignature === currentSourceSignature
    ? state.daily.status
    : "stale";
  const displayStatus = freshness === "stale"
    ? "stale"
    : state.daily.status === "saved"
      ? "saved"
      : "draft";
  return {
    entryDate: state.fixture.entryDate,
    savedSources: [sourceEntry],
    legacyHistory: [],
    pendingSaveEntryIds: [],
    sourceSignature: currentSourceSignature,
    collection: { kind: "single_entry", entryId: source.id },
    entry: clone(state.daily),
    freshness,
    displayStatus,
    latestGeneration: state.latestGeneration ? clone(state.latestGeneration) : null,
    updateBlockedByPendingSource: false
  };
}

function makeGenerationRecord(
  state: MutablePreviewCase,
  task: "generate" | "update",
  generationId: string,
  traceId: string | null,
  expectedSourceSignature: string,
  expectedContentRevision: number | null,
  now: string
): JournalDailyEntryGenerationRecord {
  return {
    id: generationId,
    entryDate: state.fixture.entryDate,
    entryId: state.daily.id,
    traceId,
    clientOperationId: `journal-preview-${task}-${state.fixture.publicId}`,
    kind: task,
    status: "completed",
    expectedSourceSignature,
    expectedContentRevision,
    resultRevisionId: `${generationId}:revision`,
    attemptCount: 1,
    errorCode: null,
    startedAt: now,
    completedAt: now,
    failedAt: null,
    canceledAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function assertEditable(state: MutablePreviewCase) {
  if (!state.fixture.editable) throw new Error("JOURNAL_PREVIEW_CASE_READ_ONLY");
}

function assertEntryId(state: MutablePreviewCase, entryId: string) {
  if (entryId !== state.record.id) {
    throw new Error("JOURNAL_PREVIEW_ENTRY_NOT_FOUND");
  }
}

function assertDailyEntryId(state: MutablePreviewCase, entryId: string) {
  if (entryId !== state.daily.id) {
    throw new Error("JOURNAL_PREVIEW_ENTRY_NOT_FOUND");
  }
}

class JournalPreviewService {
  private readonly sessions = new Map<string, PreviewSession>();
  private readonly loader: JournalPreviewFixtureLoader;
  private readonly now: () => Date;
  private readonly id: () => string;
  private fixturesPromise: Promise<JournalPreviewFixture[]> | null = null;

  constructor(dependencies: JournalPreviewServiceDependencies = {}) {
    this.loader = dependencies.loader ?? { load: defaultFixtureLoader };
    this.now = dependencies.now ?? (() => new Date());
    this.id = dependencies.id ?? randomUUID;
  }

  private async fixtures() {
    this.fixturesPromise ??= this.loader.load();
    return this.fixturesPromise;
  }

  async createSession(userId: string): Promise<JournalPreviewSessionView> {
    const fixtures = await this.fixtures();
    const sessionId = this.id();
    const cases = new Map<JournalPreviewCaseId, MutablePreviewCase>();
    for (const fixture of fixtures) {
      cases.set(fixture.publicId, {
        fixture,
        record: clone(fixture.baselineRecord),
        daily: clone(fixture.baselineDaily),
        latestGeneration: null
      });
    }
    this.sessions.set(sessionId, {
      id: sessionId,
      userId,
      createdAt: this.now().toISOString(),
      cases
    });
    return this.sessionView(this.sessions.get(sessionId)!);
  }

  readSession(userId: string, sessionId: string): JournalPreviewSessionView {
    return this.sessionView(this.session(userId, sessionId));
  }

  private session(userId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw new Error("JOURNAL_PREVIEW_SESSION_NOT_FOUND");
    return session;
  }

  private state(userId: string, sessionId: string, caseId: JournalPreviewCaseId) {
    const state = this.session(userId, sessionId).cases.get(caseId);
    if (!state) throw new Error("JOURNAL_PREVIEW_CASE_NOT_FOUND");
    return state;
  }

  private sessionView(session: PreviewSession): JournalPreviewSessionView {
    return {
      mode: JOURNAL_PREVIEW_MODE,
      sessionId: session.id,
      resetBehavior: "session_copy_auto_reset",
      modelCalls: 0,
      cases: JOURNAL_PREVIEW_CASES.map((definition) => {
        const state = session.cases.get(definition.id)!;
        const view = buildView(state);
        return {
          caseId: definition.id,
          label: definition.label,
          entryDate: view.entryDate,
          editable: definition.editable,
          eventEntryId: state.record.id,
          dailyEntryId: state.daily.id,
          sourceSignature: view.sourceSignature,
          contentRevision: state.record.contentRevision
        } satisfies JournalPreviewCaseSummary;
      })
    };
  }

  async readDay(userId: string, sessionId: string, caseId: JournalPreviewCaseId, entryDate: string): Promise<JournalPreviewDayView> {
    const state = this.state(userId, sessionId, caseId);
    if (state.fixture.entryDate !== entryDate) throw new Error("JOURNAL_PREVIEW_ENTRY_DATE_MISMATCH");
    return {
      view: buildView(state),
      record: clone(state.record),
      preview: {
        mode: JOURNAL_PREVIEW_MODE,
        sessionId,
        caseId,
        editable: state.fixture.editable,
        baselineSourceSignature: state.fixture.packageCase.source_signature,
        baselineRecordCardSha256: state.fixture.packageCase.approved_record_card_sha256,
        baselineDailySha256: state.fixture.baselineDailySha256,
        modelCalls: 0
      }
    };
  }

  async readRecord(userId: string, sessionId: string, caseId: JournalPreviewCaseId, entryId: string) {
    const state = this.state(userId, sessionId, caseId);
    if (entryId !== state.record.id) throw new Error("JOURNAL_PREVIEW_ENTRY_NOT_FOUND");
    return clone(state.record);
  }

  async updateRecord(input: {
    userId: string;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    entryId: string;
    expectedContentRevision: number;
    title: string;
    content: string;
  }) {
    const state = this.state(input.userId, input.sessionId, input.caseId);
    assertEditable(state);
    assertEntryId(state, input.entryId);
    if (state.record.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT");
    }
    if (!input.title.trim() || !input.content.trim()) throw new Error("JOURNAL_PREVIEW_ENTRY_INVALID");
    const now = this.now().toISOString();
    state.record = {
      ...state.record,
      title: input.title.trim(),
      content: input.content.trim(),
      status: state.record.status === "draft" ? "draft" : "modified",
      contentRevision: state.record.contentRevision + 1,
      editedAt: now,
      updatedAt: now
    };
    return clone(state.record);
  }

  async saveRecord(input: {
    userId: string;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    entryId: string;
    expectedContentRevision: number;
  }) {
    const state = this.state(input.userId, input.sessionId, input.caseId);
    assertEditable(state);
    assertEntryId(state, input.entryId);
    if (state.record.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT");
    }
    const now = this.now().toISOString();
    state.record = {
      ...state.record,
      status: "saved",
      savedRevision: state.record.contentRevision,
      savedAt: now,
      updatedAt: now
    };
    return clone(state.record);
  }

  async updateDailyEntry(input: {
    userId: string;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    entryId: string;
    expectedContentRevision: number;
    title: string;
    content: string;
    paragraphs?: JournalDailyParagraphDocument;
  }) {
    const state = this.state(input.userId, input.sessionId, input.caseId);
    assertEditable(state);
    assertDailyEntryId(state, input.entryId);
    if (state.daily.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT");
    }
    if (!input.title.trim() || !input.content.trim()) throw new Error("JOURNAL_PREVIEW_ENTRY_INVALID");
    const now = this.now().toISOString();
    const paragraphs = input.paragraphs ?? {
      schemaVersion: 1,
      paragraphs: input.content.split(/\n\s*\n/u).map((text) => ({
        text: text.trim(),
        sourceRecordIds: [state.record.id]
      })).filter((paragraph) => paragraph.text)
    };
    state.daily = {
      ...state.daily,
      title: input.title.trim(),
      content: input.content.trim(),
      paragraphs,
      status: state.daily.savedRevision ? "modified" : "draft",
      contentRevision: state.daily.contentRevision + 1,
      editedAt: now,
      updatedAt: now
    };
    return clone(state.daily);
  }

  async saveDailyEntry(input: {
    userId: string;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    entryId: string;
    expectedContentRevision: number;
  }) {
    const state = this.state(input.userId, input.sessionId, input.caseId);
    assertEditable(state);
    assertDailyEntryId(state, input.entryId);
    if (state.daily.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT");
    }
    const view = buildView(state);
    if (view.displayStatus === "stale") throw new Error("JOURNAL_PREVIEW_SOURCE_CHANGED");
    const now = this.now().toISOString();
    state.daily = {
      ...state.daily,
      status: "saved",
      savedRevision: state.daily.contentRevision,
      savedAt: now,
      updatedAt: now
    };
    return clone(state.daily);
  }

  async generateDaily(input: {
    userId: string;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    task: "generate" | "update";
    expectedSourceSignature: string;
    expectedContentRevision: number | null;
    clientOperationId?: string | null;
  }): Promise<JournalPreviewDailyGenerationResult> {
    const state = this.state(input.userId, input.sessionId, input.caseId);
    assertEditable(state);
    const view = buildView(state);
    if (view.sourceSignature !== input.expectedSourceSignature) throw new Error("JOURNAL_PREVIEW_SOURCE_CHANGED");
    if (state.daily.contentRevision !== input.expectedContentRevision) throw new Error("JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT");
    if (input.task === "update" && view.displayStatus !== "stale") {
      throw new Error("JOURNAL_PREVIEW_UPDATE_NOT_REQUIRED");
    }

    const now = this.now().toISOString();
    const generationId = `journal-preview:${input.caseId}:${input.task}:${state.daily.contentRevision + 1}`;
    const traceId = `journal-preview:${input.caseId}:${input.task}-trace`;
    const paragraphs = input.task === "update"
      ? this.buildFixedUpdateParagraphs(state)
      : state.daily.paragraphs.paragraphs;
    const content = paragraphs.map((paragraph) => paragraph.text).join("\n\n");
    const currentSourceSignature = view.sourceSignature;
    state.daily = {
      ...state.daily,
      title: state.daily.title,
      content,
      paragraphs: { schemaVersion: 1, paragraphs },
      status: state.daily.savedRevision ? "modified" : "draft",
      sourceSignature: currentSourceSignature,
      sourceSnapshot: this.sourceSnapshot(state),
      sourceUpdatedAt: state.record.updatedAt,
      contentRevision: state.daily.contentRevision + 1,
      currentGenerationTraceId: traceId,
      lastGenerationErrorCode: null,
      editedAt: state.daily.savedRevision ? now : null,
      updatedAt: now
    };
    state.latestGeneration = makeGenerationRecord(
      state,
      input.task,
      generationId,
      traceId,
      currentSourceSignature,
      input.expectedContentRevision,
      now
    );
    return {
      task: input.task,
      title: state.daily.title,
      paragraphs,
      sourceSignature: currentSourceSignature,
      generationTraceId: traceId,
      generationId,
      entry: clone(state.daily),
      preview: {
        mode: JOURNAL_PREVIEW_MODE,
        sessionId: input.sessionId,
        caseId: input.caseId,
        modelCalls: 0,
        resultKind: input.task === "update" ? "fixed_update_sample" : "sealed_baseline"
      }
    };
  }

  private sourceSnapshot(state: MutablePreviewCase): JournalDailyEntrySourceSnapshot {
    const source = buildView(state).savedSources[0]!;
    return { schemaVersion: 2, entryDate: state.fixture.entryDate, sources: [source] };
  }

  private buildFixedUpdateParagraphs(state: MutablePreviewCase) {
    const baselineContent = state.fixture.baselineDaily.content.trim();
    const currentContent = state.daily.content.trim();
    const manualAddition = currentContent.startsWith(baselineContent)
      ? currentContent.slice(baselineContent.length).trim()
      : currentContent === baselineContent ? "" : currentContent;
    // 固定回放只包含一张记录卡。更新稿直接采用这张卡片的当前版本，
    // 再承接用户在原日记末尾追加的内容，避免旧段落和新卡片重复出现。
    const paragraphs = [{
      text: state.record.content,
      sourceRecordIds: [state.record.id]
    }];
    if (manualAddition) paragraphs.push({ text: manualAddition, sourceRecordIds: [state.record.id] });
    return paragraphs;
  }

  resetSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}

async function defaultFixtureLoader(): Promise<JournalPreviewFixture[]> {
  const { value } = await readFixturePackage();
  const sources = await loadSourceSnapshots();
  const fixtures = JOURNAL_PREVIEW_CASES.map((definition) => {
    const internalCaseId = REQUIRED_CASE_IDS.get(definition.id)!;
    const packageCase = value.cases.find((item) => item.case_id === internalCaseId);
    if (!packageCase || !packageCase.candidate.program_check.admitted || packageCase.record_card_edited) {
      throw new Error(`JOURNAL_PREVIEW_FIXTURE_CASE_INVALID:${definition.id}`);
    }
    if (sha256Canonical(packageCase.approved_record_card) !== packageCase.approved_record_card_sha256) {
      throw new Error(`JOURNAL_PREVIEW_FIXTURE_RECORD_CARD_HASH_MISMATCH:${definition.id}`);
    }
    const source = sources.get(internalCaseId);
    if (!source
      || source.sourceFileSha256 !== packageCase.source_file_sha256
      || source.sourceProjectionSha256 !== packageCase.source_projection_sha256) {
      throw new Error(`JOURNAL_PREVIEW_FIXTURE_SOURCE_MISMATCH:${definition.id}`);
    }
    const { entryDate, record, daily } = createBaselineRecords(packageCase, definition.id, definition.label, source);
    return {
      publicId: definition.id,
      label: definition.label,
      editable: definition.editable,
      packageCase,
      source,
      entryDate,
      baselineRecord: record,
      baselineDaily: daily,
      baselineDailySha256: sha256Text(JSON.stringify(daily))
    } satisfies JournalPreviewFixture;
  });
  if (fixtures.length !== JOURNAL_PREVIEW_CASES.length) throw new Error("JOURNAL_PREVIEW_FIXTURE_CASE_SET_INVALID");
  return fixtures;
}

export const journalPreviewService = new JournalPreviewService();

export function createJournalPreviewService(dependencies: JournalPreviewServiceDependencies = {}) {
  return new JournalPreviewService(dependencies);
}
