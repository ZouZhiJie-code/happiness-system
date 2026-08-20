const LOCAL_ONLY_ERROR = "LOCAL_JOURNAL_EVALUATION_DISABLED";

function unavailable(): never {
  throw new Error(LOCAL_ONLY_ERROR);
}

export function isLocalJournalEvaluationEnabled() {
  return false;
}

export function isLocalJournalEvaluationRequest() {
  return false;
}

export function assertLocalJournalEvaluationEnvironment() {
  return unavailable();
}

export async function listJournalExtensionCases() {
  return unavailable();
}

export async function loadJournalExtensionCase() {
  return unavailable();
}

export async function saveJournalExtensionRecordDraft() {
  return unavailable();
}

export async function decideJournalExtensionRecord() {
  return unavailable();
}

export async function addJournalExtensionRecordNote() {
  return unavailable();
}

export async function saveJournalExtensionDailyDraft() {
  return unavailable();
}

export async function decideJournalExtensionDaily() {
  return unavailable();
}

export async function addJournalExtensionDailyNote() {
  return unavailable();
}

export async function listPrivateJournalCases() {
  return unavailable();
}

export async function resolvePrivateJournalCaseId() {
  return unavailable();
}

export async function loadPrivateJournalCase() {
  return unavailable();
}

export async function loadPrivateJournalReview() {
  return unavailable();
}

export async function loadPrivateJournalReviewDraft() {
  return unavailable();
}

export async function savePrivateJournalReview() {
  return unavailable();
}

export async function savePrivateJournalReviewDraft() {
  return unavailable();
}

export async function updatePrivateJournalReviewNote() {
  return unavailable();
}

export function resolveJournalRound2CaseId() {
  return null;
}

export async function listJournalRound2Cases() {
  return unavailable();
}

export async function loadJournalRound2Case() {
  return unavailable();
}

export async function saveJournalRound2Draft() {
  return unavailable();
}

export async function decideJournalRound2() {
  return unavailable();
}


export async function addJournalRound2Note() {
  return unavailable();
}

export async function saveJournalRound2ComparisonDraft() {
  return unavailable();
}

export async function decideJournalRound2Comparison() {
  return unavailable();
}
