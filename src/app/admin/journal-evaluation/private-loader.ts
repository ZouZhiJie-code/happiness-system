import { createHash } from "node:crypto";
import { appendFile, mkdir, open, readFile, unlink } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

import type {
  JournalAnonymousPreference,
  JournalCandidateRevealView,
  JournalCandidateVerdicts,
  JournalIssueAttribution,
  JournalPartialCandidateVerdicts,
  JournalPrivateCaseSummary,
  JournalQualityVerdict,
  JournalReviewCandidateView,
  JournalReviewCaseView,
  JournalReviewDraftView,
  JournalReviewJudgeView,
  JournalReviewProgramCheckView,
  JournalSavedReviewView
} from "@/components/journal-evaluation/types";

interface PrivateManifest {
  source_files: Array<{
    source_id: string;
    resolved_path: string | null;
    actual_sha256: string | null;
    import_status: "matched" | "missing";
  }>;
  trajectory_cases: Array<{
    case_id: string;
    source_group_id: string;
    source_id: string;
    source_file_sha256: string;
    record_type: "trajectory";
    synthetic: false;
    source_task_id: string;
    branch: string;
  }>;
}

interface NormalizedCandidate {
  candidate_id: string;
  title: string;
  record_cards: Array<{
    record_card_id: string;
    title: string;
    text: string;
    insight: string;
    source_refs: string[];
  }>;
  paragraphs: Array<{
    text: string;
    source_refs: string[];
    record_card_refs: string[];
  }>;
  program_check: JournalReviewProgramCheckView | null;
  judge: JournalReviewJudgeView | null;
  embedded_reveal: Omit<JournalCandidateRevealView, "candidate_id">;
}

interface NormalizedCandidatePacket {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  candidate_set_id: string;
  baseline: NormalizedCandidate | null;
  candidates: NormalizedCandidate[];
}

interface NormalizedCandidatePackage {
  execution_fingerprint: string | null;
  candidate_set_id: string | null;
  packets: NormalizedCandidatePacket[];
  artifact_path: string;
  artifact_sha256: string | null;
}

interface CandidateIdentityRecord {
  candidate_id: string;
  case_id?: string;
  candidate_set_id?: string;
  model_identity?: string | null;
  baseline_label?: string | null;
  latency_ms?: number | null;
  cost_cny?: number | null;
  cost_usd?: number | null;
}

interface CandidateIdentityPackage {
  execution_fingerprint: string | null;
  candidate_set_id: string | null;
  identities: CandidateIdentityRecord[];
  artifact_path: string;
  artifact_sha256: string | null;
}

const PRIVATE_ROOT = resolve(process.cwd(), "artifacts/journal-generation-evaluation/.private");
const DEFAULT_MANIFEST_PATH = resolve(PRIVATE_ROOT, "imported-manifest.json");
const DEFAULT_CANDIDATES_PATH = resolve(PRIVATE_ROOT, "candidate-packets.json");
const DEFAULT_IDENTITIES_PATH = resolve(PRIVATE_ROOT, "candidate-identity-map.json");
const LEGACY_IDENTITIES_PATH = resolve(PRIVATE_ROOT, "candidate-identities.json");
const DEFAULT_REVIEWS_PATH = resolve(PRIVATE_ROOT, "reviews.ndjson");
const DEFAULT_REVIEW_DRAFTS_PATH = resolve(PRIVATE_ROOT, "review-drafts.ndjson");

function privatePath(envName: string, fallback: string) {
  const configured = process.env[envName];
  const resolvedPath = configured ? resolve(configured) : fallback;
  const pathFromPrivateRoot = relative(PRIVATE_ROOT, resolvedPath);
  if (pathFromPrivateRoot === ""
    || (pathFromPrivateRoot !== ".." && !pathFromPrivateRoot.startsWith(`..${sep}`))) {
    return resolvedPath;
  }
  throw new Error("PRIVATE_JOURNAL_EVALUATION_PATH_OUTSIDE_ROOT");
}

function reviewDraftPath() {
  const configured = process.env.JOURNAL_EVALUATION_DRAFTS_PATH;
  if (configured) return privatePath("JOURNAL_EVALUATION_DRAFTS_PATH", DEFAULT_REVIEW_DRAFTS_PATH);
  const reviewPath = privatePath("JOURNAL_EVALUATION_REVIEWS_PATH", DEFAULT_REVIEWS_PATH);
  return reviewPath === DEFAULT_REVIEWS_PATH
    ? DEFAULT_REVIEW_DRAFTS_PATH
    : resolve(dirname(reviewPath), "review-drafts.ndjson");
}

async function readOptionalJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function readOptionalJsonArtifact<T>(filePath: string, fallback: T) {
  try {
    const source = await readFile(filePath, "utf8");
    return {
      value: JSON.parse(source) as T,
      sha256: createHash("sha256").update(source).digest("hex")
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { value: fallback, sha256: null };
    }
    throw error;
  }
}

async function readManifest() {
  return await readOptionalJson<PrivateManifest>(
    privatePath("JOURNAL_EVALUATION_MANIFEST_PATH", DEFAULT_MANIFEST_PATH),
    { source_files: [], trajectory_cases: [] }
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNestedObject(source: Record<string, unknown>, key: string) {
  return isObject(source[key]) ? source[key] : null;
}

function normalizeProgramCheck(value: unknown): JournalReviewProgramCheckView | null {
  if (!isObject(value) || typeof value.admitted !== "boolean") return null;
  const metrics = isObject(value.metrics)
    ? Object.fromEntries(Object.entries(value.metrics).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
    : {};
  const failures = Array.isArray(value.failures)
    ? value.failures.flatMap((failure) => {
        if (!isObject(failure) || typeof failure.code !== "string" || typeof failure.message !== "string") return [];
        return [{ code: failure.code, message: failure.message, refs: asStringArray(failure.refs) }];
      })
    : [];
  return { admitted: value.admitted, metrics, failures };
}

function normalizeJudge(value: unknown): JournalReviewJudgeView | null {
  if (!isObject(value) || typeof value.summary !== "string") return null;
  const status = value.status;
  if (status !== "not_run" && status !== "diagnostic" && status !== "passed" && status !== "failed") return null;
  return { status, summary: value.summary };
}

function normalizeEmbeddedReveal(candidate: Record<string, unknown>) {
  const reveal = readNestedObject(candidate, "reveal") ?? {};
  const model = readNestedObject(candidate, "model") ?? {};
  const runtime = readNestedObject(candidate, "runtime") ?? readNestedObject(candidate, "metrics") ?? {};
  const modelName = asString(reveal.model_identity)
    ?? asString(candidate.model_identity)
    ?? asString(model.display_name)
    ?? asString(model.model);
  const provider = asString(model.provider);
  const role = asString(candidate.candidate_role) ?? asString(candidate.candidate_kind);
  return {
    model_identity: modelName && provider && !modelName.includes(provider)
      ? `${provider} / ${modelName}`
      : modelName,
    baseline_label: asString(reveal.baseline_label)
      ?? asString(candidate.baseline_label)
      ?? (role === "baseline" ? "基线" : role),
    latency_ms: asNumber(reveal.latency_ms) ?? asNumber(candidate.latency_ms) ?? asNumber(runtime.latency_ms),
    cost_cny: asNumber(reveal.cost_cny) ?? asNumber(candidate.cost_cny) ?? asNumber(runtime.cost_cny),
    cost_usd: asNumber(reveal.cost_usd) ?? asNumber(candidate.cost_usd) ?? asNumber(runtime.cost_usd)
  };
}

function normalizeRawRecordCardForReview(candidateId: string, content: string | null) {
  if (!content) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch {
    return null;
  }
  if (!isObject(raw) || !isObject(raw.title)
    || typeof raw.title.text !== "string" || !Array.isArray(raw.blocks)) return null;
  const blocks = raw.blocks.flatMap((block) => {
    if (!isObject(block)
      || (block.kind !== "event" && block.kind !== "insight")
      || typeof block.text !== "string") return [];
    return [{
      kind: block.kind,
      text: block.text,
      source_refs: asStringArray(block.sourceRefs)
    }];
  });
  if (blocks.length === 0) return null;
  return {
    record_card_id: `review-${createHash("sha256").update(`${candidateId}:${content}`).digest("hex").slice(0, 20)}`,
    title: raw.title.text,
    text: blocks.filter((block) => block.kind === "event").map((block) => block.text).join("\n\n"),
    insight: blocks.filter((block) => block.kind === "insight").map((block) => block.text).join("\n\n"),
    source_refs: [...new Set([
      ...asStringArray(raw.title.sourceRefs),
      ...blocks.flatMap((block) => block.source_refs)
    ])]
  };
}

function normalizeCandidate(
  value: unknown,
  rawRecordCardContent: string | null = null
): NormalizedCandidate | null {
  if (!isObject(value) || typeof value.candidate_id !== "string") return null;
  const output = readNestedObject(value, "daily_output") ?? readNestedObject(value, "output") ?? value;
  const title = asString(output.title) ?? asString(value.title);
  const paragraphInput = Array.isArray(output.paragraphs)
    ? output.paragraphs
    : Array.isArray(value.paragraphs) ? value.paragraphs : null;
  if (!title || !paragraphInput) return null;
  const recordCardInput = Array.isArray(output.record_cards)
    ? output.record_cards
    : Array.isArray(value.record_cards) ? value.record_cards : [];
  const normalizedRecordCards = recordCardInput.flatMap((recordCard) => {
    if (!isObject(recordCard)
      || typeof recordCard.record_card_id !== "string"
      || typeof recordCard.text !== "string") return [];
    return [{
      record_card_id: recordCard.record_card_id,
      title: asString(recordCard.title) ?? "",
      text: recordCard.text,
      insight: asString(recordCard.insight) ?? "",
      source_refs: asStringArray(recordCard.source_refs)
    }];
  });
  const recordCards = normalizedRecordCards.length > 0
    ? normalizedRecordCards
    : [normalizeRawRecordCardForReview(value.candidate_id, rawRecordCardContent)]
        .filter((recordCard): recordCard is NonNullable<typeof recordCard> => Boolean(recordCard));
  const paragraphs = paragraphInput.flatMap((paragraph) => {
    if (typeof paragraph === "string") {
      return [{ text: paragraph, source_refs: [], record_card_refs: [] }];
    }
    if (!isObject(paragraph) || typeof paragraph.text !== "string") return [];
    return [{
      text: paragraph.text,
      source_refs: asStringArray(paragraph.source_refs),
      record_card_refs: asStringArray(paragraph.record_card_refs)
    }];
  });
  return {
    candidate_id: value.candidate_id,
    title,
    record_cards: recordCards,
    paragraphs,
    program_check: normalizeProgramCheck(value.program_check),
    judge: normalizeJudge(value.judge),
    embedded_reveal: normalizeEmbeddedReveal(value)
  };
}

function normalizeBaseline(value: unknown) {
  if (!isObject(value)) return null;
  return normalizeCandidate({
    ...value,
    candidate_id: asString(value.candidate_id) ?? "deterministic-safety-baseline"
  });
}

async function readCandidatePackets(): Promise<NormalizedCandidatePackage> {
  const artifactPath = privatePath("JOURNAL_EVALUATION_CANDIDATES_PATH", DEFAULT_CANDIDATES_PATH);
  const artifact = await readOptionalJsonArtifact<unknown>(
    artifactPath,
    { packets: [] }
  );
  const raw = artifact.value;
  if (!isObject(raw)
    || raw.schema_version !== "2.0"
    || raw.privacy_classification !== "private_local_only"
    || !isObject(raw.run)
    || raw.run.mode !== "real"
    || typeof raw.execution_fingerprint !== "string"
    || !/^[a-f0-9]{64}$/u.test(raw.execution_fingerprint)
    || typeof raw.candidate_set_id !== "string"
    || raw.candidate_set_id.trim().length === 0
    || !Array.isArray(raw.packets)) {
    return {
      execution_fingerprint: null,
      candidate_set_id: null,
      packets: [],
      artifact_path: artifactPath,
      artifact_sha256: artifact.sha256
    };
  }
  const packageExecutionFingerprint = raw.execution_fingerprint;
  const packageCandidateSetId = raw.candidate_set_id;
  const rawRecordCards = new Map<string, string>();
  if (Array.isArray(raw.raw_responses)) {
    raw.raw_responses.forEach((response) => {
      if (!isObject(response)
        || response.stage !== "record_card"
        || typeof response.candidate_id !== "string"
        || typeof response.content !== "string") return;
      rawRecordCards.set(response.candidate_id, response.content);
    });
  }
  const packets = raw.packets.flatMap((packet) => {
    if (!isObject(packet)
      || typeof packet.case_id !== "string"
      || typeof packet.source_group_id !== "string"
      || typeof packet.source_file_sha256 !== "string"
      || !/^[a-f0-9]{64}$/u.test(packet.source_file_sha256)
      || typeof packet.source_projection_sha256 !== "string"
      || !/^[a-f0-9]{64}$/u.test(packet.source_projection_sha256)
      || typeof packet.candidate_set_id !== "string"
      || packet.candidate_set_id !== packageCandidateSetId
      || !Array.isArray(packet.candidates)) return [];
    return [{
      case_id: packet.case_id,
      source_group_id: packet.source_group_id,
      source_file_sha256: packet.source_file_sha256,
      source_projection_sha256: packet.source_projection_sha256,
      candidate_set_id: packet.candidate_set_id,
      baseline: normalizeBaseline(packet.baseline ?? packet.deterministic_baseline),
      candidates: packet.candidates.flatMap((candidate) => {
        const candidateId = isObject(candidate) ? asString(candidate.candidate_id) : null;
        const normalized = normalizeCandidate(
          candidate,
          candidateId ? rawRecordCards.get(candidateId) ?? null : null
        );
        return normalized ? [normalized] : [];
      })
    }];
  });
  return {
    execution_fingerprint: packageExecutionFingerprint,
    candidate_set_id: packageCandidateSetId,
    packets,
    artifact_path: artifactPath,
    artifact_sha256: artifact.sha256
  };
}

async function readCandidateIdentities(): Promise<CandidateIdentityPackage> {
  const configuredPath = process.env.JOURNAL_EVALUATION_IDENTITIES_PATH;
  let artifactPath = configuredPath
    ? privatePath("JOURNAL_EVALUATION_IDENTITIES_PATH", DEFAULT_IDENTITIES_PATH)
    : DEFAULT_IDENTITIES_PATH;
  let artifact = await readOptionalJsonArtifact<unknown | null>(artifactPath, null);
  if (!configuredPath && artifact.value === null) {
    artifactPath = LEGACY_IDENTITIES_PATH;
    artifact = await readOptionalJsonArtifact<unknown | null>(artifactPath, { identities: [] });
  }
  const raw = artifact.value;
  if (!isObject(raw)
    || raw.privacy_classification !== "private_local_only"
    || typeof raw.execution_fingerprint !== "string"
    || !/^[a-f0-9]{64}$/u.test(raw.execution_fingerprint)
    || typeof raw.candidate_set_id !== "string"
    || raw.candidate_set_id.trim().length === 0) {
    return {
      execution_fingerprint: null,
      candidate_set_id: null,
      identities: [],
      artifact_path: artifactPath,
      artifact_sha256: artifact.sha256
    };
  }
  const identityExecutionFingerprint = raw.execution_fingerprint;
  const direct = [
    ...(Array.isArray(raw.identities) ? raw.identities : []),
    ...(Array.isArray(raw.candidates) ? raw.candidates : [])
  ];
  const packetCandidates = Array.isArray(raw.packets)
    ? raw.packets.flatMap((packet) => {
        if (!isObject(packet) || !Array.isArray(packet.candidates)) return [];
        return packet.candidates.map((candidate) => isObject(candidate)
          ? { ...candidate, case_id: packet.case_id, candidate_set_id: packet.candidate_set_id }
          : candidate);
      })
    : [];
  const packageCaseId = asString(raw.case_id) ?? undefined;
  const packageCandidateSetId = asString(raw.candidate_set_id) ?? undefined;
  const identities = [...direct, ...packetCandidates].flatMap((identity) => {
    if (!isObject(identity) || typeof identity.candidate_id !== "string") return [];
    return [{
      candidate_id: identity.candidate_id,
      case_id: asString(identity.case_id) ?? packageCaseId,
      candidate_set_id: asString(identity.candidate_set_id) ?? packageCandidateSetId,
      model_identity: asString(identity.model_identity),
      baseline_label: asString(identity.baseline_label),
      latency_ms: asNumber(identity.latency_ms),
      cost_cny: asNumber(identity.cost_cny),
      cost_usd: asNumber(identity.cost_usd)
    }];
  });
  return {
    execution_fingerprint: identityExecutionFingerprint,
    candidate_set_id: packageCandidateSetId ?? null,
    identities,
    artifact_path: artifactPath,
    artifact_sha256: artifact.sha256
  };
}

function artifactUsesContinuationDirectory(artifactPath: string) {
  return relative(PRIVATE_ROOT, dirname(artifactPath)).split(sep).includes("continuations");
}

async function continuationArtifactsAreCommitted(
  candidatePackage: NormalizedCandidatePackage,
  identityPackage: CandidateIdentityPackage
) {
  if (!artifactUsesContinuationDirectory(candidatePackage.artifact_path)) return true;
  const artifactDirectory = dirname(candidatePackage.artifact_path);
  if (dirname(identityPackage.artifact_path) !== artifactDirectory
    || basename(candidatePackage.artifact_path) !== "candidate-packets.json"
    || basename(identityPackage.artifact_path) !== "candidate-identity-map.json"
    || !candidatePackage.artifact_sha256
    || !identityPackage.artifact_sha256
    || !candidatePackage.execution_fingerprint
    || !candidatePackage.candidate_set_id) return false;
  const manifest = await readOptionalJson<unknown>(
    resolve(artifactDirectory, "commit-manifest.json"),
    null
  );
  if (!isObject(manifest)
    || manifest.schema_version !== "1.0"
    || manifest.status !== "committed"
    || manifest.execution_fingerprint !== candidatePackage.execution_fingerprint
    || manifest.execution_fingerprint !== identityPackage.execution_fingerprint
    || manifest.candidate_set_id !== candidatePackage.candidate_set_id
    || manifest.candidate_set_id !== identityPackage.candidate_set_id
    || !isObject(manifest.child_artifacts)
    || manifest.child_artifacts.package_sha256 !== candidatePackage.artifact_sha256
    || manifest.child_artifacts.identity_sha256 !== identityPackage.artifact_sha256
    || !isObject(manifest.files)
    || manifest.files.package !== basename(candidatePackage.artifact_path)
    || manifest.files.identity !== basename(identityPackage.artifact_path)) return false;
  return true;
}

async function readReviewCandidateBundle() {
  const [candidatePackage, identityPackage] = await Promise.all([
    readCandidatePackets(),
    readCandidateIdentities()
  ]);
  return {
    candidatePackage,
    identityPackage,
    continuationCommitted: await continuationArtifactsAreCommitted(candidatePackage, identityPackage)
  };
}

function stablePresentation(packet: NormalizedCandidatePacket) {
  if (packet.candidates.length !== 2) return null;
  const shouldReverse = Number.parseInt(
    createHash("sha256").update(`${packet.case_id}:${packet.candidate_set_id}`).digest("hex").slice(0, 2),
    16
  ) % 2 === 1;
  const ordered = shouldReverse ? [...packet.candidates].reverse() : [...packet.candidates];
  const visibleCandidateFingerprint = createHash("sha256")
    .update(JSON.stringify(ordered.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      title: candidate.title,
      record_cards: candidate.record_cards,
      paragraphs: candidate.paragraphs
    }))))
    .digest("hex");
  const presentationId = createHash("sha256")
    .update([
      packet.case_id,
      packet.source_group_id,
      packet.source_file_sha256,
      packet.source_projection_sha256,
      packet.candidate_set_id,
      visibleCandidateFingerprint
    ].join(":"))
    .digest("hex");
  return { ordered, presentationId };
}

function packetMatchesCase(
  packet: NormalizedCandidatePacket,
  evaluationCase: PrivateManifest["trajectory_cases"][number]
) {
  return packet.case_id === evaluationCase.case_id
    && packet.source_group_id === evaluationCase.source_group_id
    && packet.source_file_sha256 === evaluationCase.source_file_sha256;
}

export function isLocalJournalEvaluationEnabled() {
  try {
    assertLocalJournalEvaluationEnvironment();
    return true;
  } catch {
    return false;
  }
}

export function isLocalJournalEvaluationRequest(request: Request) {
  const url = new URL(request.url);
  const hostnameIsLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (!hostnameIsLocal) return false;
  const protectedPath =
    url.pathname.startsWith("/api/local/gi088-v8r3") ||
    url.pathname.startsWith("/admin/journal-evaluation/golden-eight");
  if (!protectedPath) return true;
  const expectedToken = process.env.GI088_V8R3_REVIEW_TOKEN?.trim();
  if (!expectedToken) return false;
  const presentedToken =
    request.headers.get("x-gi088-review-token") ?? url.searchParams.get("token");
  return presentedToken === expectedToken;
}

function presentationIsComplete(presentation: ReturnType<typeof stablePresentation>) {
  return Boolean(presentation && presentation.ordered.every((candidate) =>
    candidate.record_cards.some((recordCard) => recordCard.text.trim().length > 0)
      && candidate.paragraphs.some((paragraph) => paragraph.text.trim().length > 0)
  ));
}

function identityMappingIsComplete(
  packet: NormalizedCandidatePacket,
  candidatePackage: NormalizedCandidatePackage,
  identityPackage: CandidateIdentityPackage
) {
  if (!candidatePackage.execution_fingerprint
    || !candidatePackage.candidate_set_id
    || identityPackage.execution_fingerprint !== candidatePackage.execution_fingerprint
    || identityPackage.candidate_set_id !== candidatePackage.candidate_set_id
    || packet.candidate_set_id !== candidatePackage.candidate_set_id) return false;
  const candidateIds = packet.candidates.map((candidate) => candidate.candidate_id);
  if (new Set(candidateIds).size !== candidateIds.length) return false;
  const matchingIdentities = identityPackage.identities.filter((identity) =>
    identity.case_id === packet.case_id && identity.candidate_set_id === packet.candidate_set_id
  );
  return matchingIdentities.length === candidateIds.length
    && candidateIds.every((candidateId) => matchingIdentities.filter((identity) =>
      identity.candidate_id === candidateId && Boolean(identity.model_identity?.trim())
    ).length === 1);
}

function presentationIsReviewReady(
  presentation: ReturnType<typeof stablePresentation>,
  packet: NormalizedCandidatePacket,
  candidatePackage: NormalizedCandidatePackage,
  identityPackage: CandidateIdentityPackage,
  continuationCommitted: boolean
) {
  return continuationCommitted
    && presentationIsComplete(presentation)
    && identityMappingIsComplete(packet, candidatePackage, identityPackage);
}

export function assertLocalJournalEvaluationEnvironment() {
  if (process.env.NODE_ENV === "production"
    || process.env.VERCEL_ENV
    || process.env.JOURNAL_EVALUATION_LOCAL_ENABLED !== "I_UNDERSTAND") {
    throw new Error("LOCAL_JOURNAL_EVALUATION_ENVIRONMENT_INVALID");
  }
  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = process.env[name];
    if (!value) throw new Error("LOCAL_JOURNAL_EVALUATION_ENVIRONMENT_INVALID");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("LOCAL_JOURNAL_EVALUATION_ENVIRONMENT_INVALID");
    }
    const database = url.pathname.replace(/^\//, "");
    if ((url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]")
      || database !== "happiness_system_codex"
      || url.searchParams.get("schema") !== "journal_daily_eval") {
      throw new Error("LOCAL_JOURNAL_EVALUATION_ENVIRONMENT_INVALID");
    }
  }
}

export async function listPrivateJournalCases(): Promise<JournalPrivateCaseSummary[]> {
  const [manifest, candidateBundle] = await Promise.all([
    readManifest(),
    readReviewCandidateBundle()
  ]);
  const { candidatePackage, identityPackage, continuationCommitted } = candidateBundle;
  const candidatePackets = candidatePackage.packets;
  return manifest.trajectory_cases
    .filter((evaluationCase) => candidatePackets.some((packet) =>
      packetMatchesCase(packet, evaluationCase) && Boolean(stablePresentation(packet))
    ))
    .map((evaluationCase) => ({
      case_id: createHash("sha256").update(`journal-evaluation:${evaluationCase.case_id}`).digest("hex").slice(0, 24),
      record_type: "trajectory",
      synthetic: false,
      review_ready: (() => {
        const packet = candidatePackets.find((item) => packetMatchesCase(item, evaluationCase));
        if (!packet) return false;
        return presentationIsReviewReady(
          stablePresentation(packet),
          packet,
          candidatePackage,
          identityPackage,
          continuationCommitted
        );
      })()
    }));
}

export async function resolvePrivateJournalCaseId(publicCaseId: string) {
  const manifest = await readManifest();
  return manifest.trajectory_cases.find((evaluationCase) =>
    createHash("sha256").update(`journal-evaluation:${evaluationCase.case_id}`).digest("hex").slice(0, 24) === publicCaseId
  )?.case_id ?? null;
}

export async function loadPrivateJournalCase(
  caseId: string,
  options: { reveal?: boolean } = {}
): Promise<JournalReviewCaseView | null> {
  const [manifest, candidateBundle] = await Promise.all([
    readManifest(),
    readReviewCandidateBundle()
  ]);
  const { candidatePackage, identityPackage, continuationCommitted } = candidateBundle;
  const candidatePackets = candidatePackage.packets;
  const identities = identityPackage.identities;
  const evaluationCase = manifest.trajectory_cases.find((item) => item.case_id === caseId);
  if (!evaluationCase) return null;
  const source = manifest.source_files.find((item) => item.source_id === evaluationCase.source_id);
  if (!source?.resolved_path || source.import_status !== "matched") throw new Error("PRIVATE_SOURCE_UNAVAILABLE");

  const sourceBuffer = await readFile(source.resolved_path);
  const actualSha256 = createHash("sha256").update(sourceBuffer).digest("hex");
  if (actualSha256 !== evaluationCase.source_file_sha256 || actualSha256 !== source.actual_sha256) {
    throw new Error("PRIVATE_SOURCE_HASH_MISMATCH");
  }
  const raw = JSON.parse(sourceBuffer.toString("utf8")) as unknown;
  if (!isObject(raw) || !isObject(raw.batch) || !Array.isArray(raw.batch.tasks)) {
    throw new Error("PRIVATE_SOURCE_INVALID");
  }
  const task = raw.batch.tasks.find((item) => isObject(item) && item.taskId === evaluationCase.source_task_id);
  if (!isObject(task) || !isObject(task.branches)) throw new Error("PRIVATE_TRAJECTORY_UNAVAILABLE");
  const trajectory = task.branches[evaluationCase.branch];
  if (!isObject(trajectory) || !Array.isArray(trajectory.messages)) throw new Error("PRIVATE_TRAJECTORY_UNAVAILABLE");
  const transcript = trajectory.messages.flatMap((message) => {
    if (!isObject(message)
      || typeof message.id !== "string"
      || (message.role !== "user" && message.role !== "assistant")
      || typeof message.content !== "string") return [];
    const role: "user" | "assistant" = message.role;
    return [{ message_id: message.id, role, content: message.content }];
  });

  const packet = candidatePackets.find((item) => packetMatchesCase(item, evaluationCase));
  const presentation = packet ? stablePresentation(packet) : null;
  const mapCandidate = (candidate: NormalizedCandidate, label: "A" | "B"): JournalReviewCandidateView => {
    const visible: JournalReviewCandidateView = {
      label,
      title: candidate.title,
      record_cards: candidate.record_cards,
      paragraphs: candidate.paragraphs.map((paragraph) => paragraph.text),
      paragraph_sources: candidate.paragraphs.map((paragraph) => ({
        source_refs: paragraph.source_refs,
        record_card_refs: paragraph.record_card_refs
      }))
    };
    if (!options.reveal) return visible;
    const identity = identities.find((item) => item.candidate_id === candidate.candidate_id
      && (!item.case_id || item.case_id === caseId)
      && (!item.candidate_set_id || item.candidate_set_id === packet?.candidate_set_id));
    return {
      ...visible,
      program_check: candidate.program_check,
      judge: candidate.judge,
      reveal: {
        candidate_id: candidate.candidate_id,
        model_identity: identity?.model_identity ?? candidate.embedded_reveal.model_identity,
        baseline_label: identity?.baseline_label ?? candidate.embedded_reveal.baseline_label,
        latency_ms: identity?.latency_ms ?? candidate.embedded_reveal.latency_ms,
        cost_cny: identity?.cost_cny ?? candidate.embedded_reveal.cost_cny,
        cost_usd: identity?.cost_usd ?? candidate.embedded_reveal.cost_usd
      }
    };
  };
  return {
    case_id: evaluationCase.case_id,
    title: `私有轨迹 ${evaluationCase.source_task_id}`,
    scenario: "原对话仅在本地管理员会话中按需读取。",
    source_group_id: evaluationCase.source_group_id,
    source_file_sha256: evaluationCase.source_file_sha256,
    record_type: "trajectory",
    synthetic: false,
    transcript,
    candidates: presentation ? [
      mapCandidate(presentation.ordered[0], "A"),
      mapCandidate(presentation.ordered[1], "B")
    ] : null,
    ...(options.reveal && packet?.baseline ? {
      baseline: {
        label: "确定性安全基线",
        title: packet.baseline.title,
        record_cards: packet.baseline.record_cards,
        paragraphs: packet.baseline.paragraphs.map((paragraph) => paragraph.text),
        paragraph_sources: packet.baseline.paragraphs.map((paragraph) => ({
          source_refs: paragraph.source_refs,
          record_card_refs: paragraph.record_card_refs
        }))
      }
    } : {}),
    presentation_id: presentation?.presentationId ?? null,
    review_ready: packet
      ? presentationIsReviewReady(
          presentation,
          packet,
          candidatePackage,
          identityPackage,
          continuationCommitted
        )
      : false
  };
}

const QUALITY_VERDICTS = new Set<JournalQualityVerdict>([
  "ready_to_use", "minor_edit", "major_rewrite", "quality_failure"
]);
const PREFERENCES = new Set<JournalAnonymousPreference>([
  "prefer_a", "prefer_b", "no_preference", "skip"
]);
const ISSUE_ATTRIBUTIONS = new Set<JournalIssueAttribution>([
  "source_fidelity", "coverage_omission", "record_card_quality", "daily_structure",
  "tone_naturalness", "over_inference", "no_material_issue", "other"
]);

function validateNote(note: string) {
  const trimmed = note.trim();
  if (trimmed.length > 500) throw new Error("PRIVATE_REVIEW_NOTE_TOO_LONG");
  return trimmed;
}

function validVerdict(value: unknown): value is JournalQualityVerdict {
  return QUALITY_VERDICTS.has(value as JournalQualityVerdict);
}

function validateVerdicts(verdicts: JournalCandidateVerdicts) {
  return validVerdict(verdicts.A) && validVerdict(verdicts.B);
}

function validatePartialVerdicts(verdicts: JournalPartialCandidateVerdicts) {
  return (verdicts.A === null || validVerdict(verdicts.A))
    && (verdicts.B === null || validVerdict(verdicts.B));
}

function validateAttributions(attributions: JournalIssueAttribution[], allowEmpty: boolean) {
  return (allowEmpty || attributions.length > 0)
    && attributions.every((item) => ISSUE_ATTRIBUTIONS.has(item))
    && !(attributions.includes("no_material_issue") && attributions.length > 1);
}

function validateDecision(input: {
  record_card_verdicts: JournalCandidateVerdicts;
  daily_verdicts: JournalCandidateVerdicts;
  preference: JournalAnonymousPreference;
  issue_attributions: JournalIssueAttribution[];
}) {
  if (!validateVerdicts(input.record_card_verdicts)
    || !validateVerdicts(input.daily_verdicts)
    || !PREFERENCES.has(input.preference)
    || !validateAttributions(input.issue_attributions, false)) {
    throw new Error("PRIVATE_REVIEW_INVALID");
  }
}

async function readNdjsonEvents(filePath: string) {
  try {
    const source = await readFile(filePath, "utf8");
    return source.split(/\r?\n/).flatMap((line) => {
      if (!line.trim()) return [];
      try {
        const parsed = JSON.parse(line) as unknown;
        return isObject(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readReviewEvents() {
  return await readNdjsonEvents(privatePath("JOURNAL_EVALUATION_REVIEWS_PATH", DEFAULT_REVIEWS_PATH));
}

async function readReviewDraftEvents() {
  return await readNdjsonEvents(reviewDraftPath());
}

export async function loadPrivateJournalReviewDraft(input: {
  case_id: string;
  presentation_id: string;
  reviewer_id: string;
}): Promise<JournalReviewDraftView | null> {
  const events = await readReviewDraftEvents();
  const draft = events
    .filter((event) => event.schema_version === "3.0"
      && event.event_type === "draft_snapshot"
      && event.case_id === input.case_id
      && event.presentation_id === input.presentation_id
      && event.reviewer_id === input.reviewer_id)
    .sort((left, right) => Number(left.revision ?? 0) - Number(right.revision ?? 0))
    .at(-1);
  if (!draft
    || !isObject(draft.record_card_verdicts)
    || !isObject(draft.daily_verdicts)
    || !Array.isArray(draft.issue_attributions)
    || typeof draft.note !== "string"
    || typeof draft.revision !== "number"
    || typeof draft.updated_at !== "string") return null;
  const recordCardVerdicts: JournalPartialCandidateVerdicts = {
    A: validVerdict(draft.record_card_verdicts.A) ? draft.record_card_verdicts.A : null,
    B: validVerdict(draft.record_card_verdicts.B) ? draft.record_card_verdicts.B : null
  };
  const dailyVerdicts: JournalPartialCandidateVerdicts = {
    A: validVerdict(draft.daily_verdicts.A) ? draft.daily_verdicts.A : null,
    B: validVerdict(draft.daily_verdicts.B) ? draft.daily_verdicts.B : null
  };
  const preference = PREFERENCES.has(draft.preference as JournalAnonymousPreference)
    ? draft.preference as JournalAnonymousPreference
    : null;
  const issueAttributions = draft.issue_attributions.filter(
    (item): item is JournalIssueAttribution => ISSUE_ATTRIBUTIONS.has(item as JournalIssueAttribution)
  );
  if (!validatePartialVerdicts(recordCardVerdicts)
    || !validatePartialVerdicts(dailyVerdicts)
    || !validateAttributions(issueAttributions, true)) return null;
  return {
    case_id: input.case_id,
    presentation_id: input.presentation_id,
    record_card_verdicts: recordCardVerdicts,
    daily_verdicts: dailyVerdicts,
    preference,
    issue_attributions: issueAttributions,
    note: draft.note,
    revision: draft.revision,
    updated_at: draft.updated_at
  };
}

export async function savePrivateJournalReviewDraft(input: {
  case_id: string;
  presentation_id: string;
  record_card_verdicts: JournalPartialCandidateVerdicts;
  daily_verdicts: JournalPartialCandidateVerdicts;
  preference: JournalAnonymousPreference | null;
  issue_attributions: JournalIssueAttribution[];
  note: string;
  reviewer_id: string;
}): Promise<JournalReviewDraftView> {
  if (!validatePartialVerdicts(input.record_card_verdicts)
    || !validatePartialVerdicts(input.daily_verdicts)
    || (input.preference !== null && !PREFERENCES.has(input.preference))
    || !validateAttributions(input.issue_attributions, true)) {
    throw new Error("PRIVATE_REVIEW_DRAFT_INVALID");
  }
  const evaluationCase = await loadPrivateJournalCase(input.case_id);
  if (!evaluationCase?.presentation_id || evaluationCase.presentation_id !== input.presentation_id) {
    throw new Error("PRIVATE_REVIEW_PRESENTATION_MISMATCH");
  }
  if (!evaluationCase.review_ready) throw new Error("PRIVATE_REVIEW_CANDIDATE_INCOMPLETE");
  const existingDecision = await loadPrivateJournalReview(input);
  if (existingDecision) throw new Error("PRIVATE_REVIEW_ALREADY_DECIDED");
  const draftPath = reviewDraftPath();
  await mkdir(dirname(draftPath), { recursive: true, mode: 0o700 });
  const draftKey = createHash("sha256").update([
    input.case_id,
    input.presentation_id,
    input.reviewer_id
  ].join(":"))
    .digest("hex");
  const lockPath = `${draftPath}.${draftKey}.lock`;
  let lockHandle: Awaited<ReturnType<typeof open>>;
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("PRIVATE_REVIEW_DRAFT_BUSY");
    }
    throw error;
  }
  try {
    const previous = await loadPrivateJournalReviewDraft(input);
    const revision = (previous?.revision ?? 0) + 1;
    const updatedAt = new Date().toISOString();
    const note = validateNote(input.note);
    const draft: JournalReviewDraftView = {
      case_id: input.case_id,
      presentation_id: input.presentation_id,
      record_card_verdicts: input.record_card_verdicts,
      daily_verdicts: input.daily_verdicts,
      preference: input.preference,
      issue_attributions: input.issue_attributions,
      note,
      revision,
      updated_at: updatedAt
    };
    await appendFile(draftPath, `${JSON.stringify({
      schema_version: "3.0",
      event_type: "draft_snapshot",
      ...draft,
      reviewer_id: input.reviewer_id
    })}\n`, { encoding: "utf8", mode: 0o600 });
    return draft;
  } finally {
    await lockHandle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

export async function loadPrivateJournalReview(input: {
  case_id: string;
  presentation_id: string;
  reviewer_id: string;
}): Promise<JournalSavedReviewView | null> {
  const events = await readReviewEvents();
  const matches = events.filter((event) => event.case_id === input.case_id
    && event.presentation_id === input.presentation_id
    && event.reviewer_id === input.reviewer_id);
  const decision = matches.find((event) => event.schema_version === "3.0" && event.event_type === "decision");
  if (!decision
    || !isObject(decision.record_card_verdicts)
    || !isObject(decision.daily_verdicts)
    || typeof decision.reviewed_at !== "string"
    || typeof decision.note !== "string"
    || !Array.isArray(decision.issue_attributions)) return null;
  const recordCardVerdicts = {
    A: decision.record_card_verdicts.A as JournalQualityVerdict,
    B: decision.record_card_verdicts.B as JournalQualityVerdict
  };
  const dailyVerdicts = {
    A: decision.daily_verdicts.A as JournalQualityVerdict,
    B: decision.daily_verdicts.B as JournalQualityVerdict
  };
  if (!validateVerdicts(recordCardVerdicts) || !validateVerdicts(dailyVerdicts)) return null;
  const noteEvents = matches.filter((event) => event.event_type === "note_updated"
    && typeof event.note === "string"
    && typeof event.note_updated_at === "string");
  const latestNote = noteEvents.at(-1);
  return {
    case_id: input.case_id,
    presentation_id: input.presentation_id,
    record_card_verdicts: recordCardVerdicts,
    daily_verdicts: dailyVerdicts,
    preference: decision.preference as JournalAnonymousPreference,
    issue_attributions: decision.issue_attributions as JournalIssueAttribution[],
    note: latestNote ? String(latestNote.note) : decision.note,
    reviewed_at: decision.reviewed_at,
    ...(latestNote ? { note_updated_at: String(latestNote.note_updated_at) } : {})
  };
}

export async function savePrivateJournalReview(input: {
  case_id: string;
  presentation_id: string;
  record_card_verdicts: JournalCandidateVerdicts;
  daily_verdicts: JournalCandidateVerdicts;
  preference: JournalAnonymousPreference;
  issue_attributions: JournalIssueAttribution[];
  note: string;
  reviewer_id: string;
}): Promise<JournalSavedReviewView> {
  validateDecision(input);
  const evaluationCase = await loadPrivateJournalCase(input.case_id);
  if (!evaluationCase?.presentation_id || evaluationCase.presentation_id !== input.presentation_id) {
    throw new Error("PRIVATE_REVIEW_PRESENTATION_MISMATCH");
  }
  if (!evaluationCase.review_ready) throw new Error("PRIVATE_REVIEW_CANDIDATE_INCOMPLETE");
  const reviewPath = privatePath("JOURNAL_EVALUATION_REVIEWS_PATH", DEFAULT_REVIEWS_PATH);
  await mkdir(dirname(reviewPath), { recursive: true, mode: 0o700 });
  const decisionKey = createHash("sha256").update([
    input.case_id,
    input.presentation_id,
    input.reviewer_id
  ].join(":"))
    .digest("hex");
  const lockPath = `${reviewPath}.${decisionKey}.lock`;
  let lockHandle: Awaited<ReturnType<typeof open>>;
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("PRIVATE_REVIEW_ALREADY_DECIDED");
    }
    throw error;
  }
  try {
    const existing = await loadPrivateJournalReview(input);
    if (existing) throw new Error("PRIVATE_REVIEW_ALREADY_DECIDED");
    const reviewedAt = new Date().toISOString();
    const note = validateNote(input.note);
    await appendFile(reviewPath, `${JSON.stringify({
      schema_version: "3.0",
      event_type: "decision",
      reviewed_at: reviewedAt,
      case_id: input.case_id,
      source_group_id: evaluationCase.source_group_id,
      source_file_sha256: evaluationCase.source_file_sha256,
      synthetic: false,
      presentation_id: input.presentation_id,
      record_card_verdicts: input.record_card_verdicts,
      daily_verdicts: input.daily_verdicts,
      preference: input.preference,
      issue_attributions: input.issue_attributions,
      note,
      reviewer_id: input.reviewer_id
    })}\n`, { encoding: "utf8", mode: 0o600 });
    return {
      case_id: input.case_id,
      presentation_id: input.presentation_id,
      record_card_verdicts: input.record_card_verdicts,
      daily_verdicts: input.daily_verdicts,
      preference: input.preference,
      issue_attributions: input.issue_attributions,
      note,
      reviewed_at: reviewedAt
    };
  } finally {
    await lockHandle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

export async function updatePrivateJournalReviewNote(input: {
  case_id: string;
  presentation_id: string;
  note: string;
  reviewer_id: string;
}): Promise<JournalSavedReviewView> {
  const existing = await loadPrivateJournalReview(input);
  if (!existing) throw new Error("PRIVATE_REVIEW_DECISION_REQUIRED");
  const note = validateNote(input.note);
  const noteUpdatedAt = new Date().toISOString();
  const reviewPath = privatePath("JOURNAL_EVALUATION_REVIEWS_PATH", DEFAULT_REVIEWS_PATH);
  await mkdir(dirname(reviewPath), { recursive: true, mode: 0o700 });
  await appendFile(reviewPath, `${JSON.stringify({
    schema_version: "3.0",
    event_type: "note_updated",
    note_updated_at: noteUpdatedAt,
    case_id: input.case_id,
    presentation_id: input.presentation_id,
    note,
    reviewer_id: input.reviewer_id
  })}\n`, { encoding: "utf8", mode: 0o600 });
  return { ...existing, note, note_updated_at: noteUpdatedAt };
}
