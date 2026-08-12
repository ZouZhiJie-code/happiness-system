import {
  JOURNAL_PREVIEW_MODE,
  JOURNAL_PREVIEW_CASES,
  type JournalPreviewCaseId,
  type JournalPreviewRequestContext
} from "./contract";

export const JOURNAL_PREVIEW_MODE_HEADER = "x-daily-light-preview";
export const JOURNAL_PREVIEW_SESSION_HEADER = "x-daily-light-preview-session";
export const JOURNAL_PREVIEW_CASE_HEADER = "x-daily-light-preview-case";
export const JOURNAL_PREVIEW_ENV = "DAILY_LIGHT_JOURNAL_PREVIEW_ENABLED";

function isLocalHost(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function assertJournalPreviewEnvironment(request: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV ||
    process.env[JOURNAL_PREVIEW_ENV] !== "I_UNDERSTAND" ||
    !isLocalHost(request)
  ) {
    throw new Error("JOURNAL_PREVIEW_ENVIRONMENT_INVALID");
  }
}

function parseCaseId(value: string | null): JournalPreviewCaseId {
  if (value && JOURNAL_PREVIEW_CASES.some((item) => item.id === value)) {
    return value as JournalPreviewCaseId;
  }
  throw new Error("JOURNAL_PREVIEW_CASE_REQUIRED");
}

export function readJournalPreviewRequest(
  request: Request,
  options: { requireContext?: boolean } = {}
): JournalPreviewRequestContext | null {
  const mode = request.headers.get(JOURNAL_PREVIEW_MODE_HEADER);
  if (!mode) return null;
  assertJournalPreviewEnvironment(request);
  if (mode !== JOURNAL_PREVIEW_MODE) {
    throw new Error("JOURNAL_PREVIEW_MODE_INVALID");
  }

  const sessionId = request.headers.get(JOURNAL_PREVIEW_SESSION_HEADER)?.trim() ?? "";
  const caseId = request.headers.get(JOURNAL_PREVIEW_CASE_HEADER)?.trim() ?? "";
  if (!options.requireContext && !sessionId && !caseId) return null;
  if (!sessionId) throw new Error("JOURNAL_PREVIEW_SESSION_REQUIRED");
  return { mode, sessionId, caseId: parseCaseId(caseId) };
}

export function assertJournalPreviewSessionRequest(request: Request) {
  assertJournalPreviewEnvironment(request);
  const mode = request.headers.get(JOURNAL_PREVIEW_MODE_HEADER);
  if (mode !== JOURNAL_PREVIEW_MODE) throw new Error("JOURNAL_PREVIEW_MODE_INVALID");
}

export function isJournalPreviewRequest(request: Request) {
  return request.headers.has(JOURNAL_PREVIEW_MODE_HEADER);
}

export function journalPreviewStatusFor(code: string) {
  if (code === "JOURNAL_PREVIEW_ENVIRONMENT_INVALID") return 404;
  if (
    code === "JOURNAL_PREVIEW_SESSION_REQUIRED" ||
    code === "JOURNAL_PREVIEW_CASE_REQUIRED" ||
    code === "JOURNAL_PREVIEW_MODE_INVALID" ||
    code === "JOURNAL_PREVIEW_TASK_REQUIRED"
  ) return 400;
  if (
    code === "JOURNAL_PREVIEW_SESSION_NOT_FOUND" ||
    code === "JOURNAL_PREVIEW_CASE_NOT_FOUND" ||
    code === "JOURNAL_PREVIEW_ENTRY_NOT_FOUND" ||
    code === "JOURNAL_PREVIEW_FIXTURE_PACKAGE_MISSING"
  ) return 404;
  if (
    code === "JOURNAL_PREVIEW_CASE_READ_ONLY" ||
    code === "JOURNAL_PREVIEW_ENTRY_DATE_MISMATCH" ||
    code === "JOURNAL_PREVIEW_ENTRY_VERSION_CONFLICT" ||
    code === "JOURNAL_PREVIEW_SOURCE_CHANGED" ||
    code === "JOURNAL_PREVIEW_UPDATE_NOT_REQUIRED" ||
    code === "JOURNAL_PREVIEW_MODEL_CALL_DISABLED"
  ) return 409;
  if (code.startsWith("JOURNAL_PREVIEW_FIXTURE_")) return 503;
  return 500;
}
