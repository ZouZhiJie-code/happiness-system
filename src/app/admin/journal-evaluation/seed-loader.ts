import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { JournalReviewCaseView } from "@/components/journal-evaluation/types";

interface SeedDatasetFile {
  cases: Array<{
    case_id: string;
    title: string;
    scenario: string;
    source_group_id: string;
    source_file_sha256: null;
    record_type: "trajectory" | "derived";
    synthetic: true;
    transcript: JournalReviewCaseView["transcript"];
    candidates: Array<{
      candidate_id: string;
      record_cards: Array<{
        record_card_id: string;
        text: string;
        insight: string;
        source_refs: string[];
      }>;
      daily_output: {
        title: string;
        paragraphs: Array<{
          text: string;
          source_refs: string[];
          record_card_refs: string[];
        }>;
      };
    }>;
  }>;
}

interface SeedStaticReportFile {
  cases: Array<{
    case_id: string;
    candidates: Array<{
      candidate_id: string;
      admitted: boolean;
      metrics: Record<string, number>;
      failures: Array<{ code: string; message: string; refs: string[] }>;
    }>;
  }>;
}

function seedCandidateIsComplete(candidate: SeedDatasetFile["cases"][number]["candidates"][number]) {
  return candidate.record_cards.some((recordCard) => recordCard.text.trim().length > 0)
    && candidate.daily_output.paragraphs.some((paragraph) => paragraph.text.trim().length > 0);
}

async function loadSeedStaticReport(): Promise<SeedStaticReportFile | null> {
  try {
    return JSON.parse(await readFile(
      resolve(process.cwd(), "artifacts/journal-generation-evaluation/seed-static-report.json"),
      "utf8"
    )) as SeedStaticReportFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function loadSeedJournalCases(options: { reveal?: boolean } = {}): Promise<JournalReviewCaseView[]> {
  const [dataset, staticReport] = await Promise.all([
    readFile(
      resolve(process.cwd(), "artifacts/journal-generation-evaluation/seed-cases.json"),
      "utf8"
    ).then((source) => JSON.parse(source) as SeedDatasetFile),
    options.reveal ? loadSeedStaticReport() : Promise.resolve(null)
  ]);
  return dataset.cases.map((evaluationCase) => {
    const candidates = [...evaluationCase.candidates];
    const reverse = Number.parseInt(
      createHash("sha256").update(evaluationCase.case_id).digest("hex").slice(0, 2),
      16
    ) % 2 === 1;
    if (reverse) candidates.reverse();
    const presentationId = createHash("sha256")
      .update(`${evaluationCase.case_id}:${candidates.map((candidate) => candidate.candidate_id).join(":")}`)
      .digest("hex");
    const staticCase = staticReport?.cases.find((item) => item.case_id === evaluationCase.case_id);
    const reviewReady = candidates.length === 2 && candidates.every(seedCandidateIsComplete);
    const mapCandidate = (candidate: (typeof candidates)[number], label: "A" | "B") => {
      const visible = {
        label,
        title: candidate.daily_output.title,
        record_cards: candidate.record_cards.map((recordCard) => ({
          record_card_id: recordCard.record_card_id,
          title: "",
          text: recordCard.text,
          insight: recordCard.insight,
          source_refs: recordCard.source_refs
        })),
        paragraphs: candidate.daily_output.paragraphs.map((paragraph) => paragraph.text),
        paragraph_sources: candidate.daily_output.paragraphs.map((paragraph) => ({
          source_refs: paragraph.source_refs,
          record_card_refs: paragraph.record_card_refs
        }))
      };
      if (!options.reveal) return visible;
      const programCheck = staticCase?.candidates.find(
        (item) => item.candidate_id === candidate.candidate_id
      ) ?? null;
      return {
        ...visible,
        program_check: programCheck,
        judge: null,
        reveal: {
          candidate_id: candidate.candidate_id,
          model_identity: null,
          baseline_label: "合成种子候选",
          latency_ms: null,
          cost_cny: null,
          cost_usd: null
        }
      };
    };
    return {
      case_id: evaluationCase.case_id,
      title: evaluationCase.title,
      scenario: evaluationCase.scenario,
      source_group_id: evaluationCase.source_group_id,
      source_file_sha256: null,
      record_type: evaluationCase.record_type,
      synthetic: true,
      transcript: evaluationCase.transcript,
      candidates: [mapCandidate(candidates[0], "A"), mapCandidate(candidates[1], "B")],
      presentation_id: presentationId,
      review_ready: reviewReady
    };
  });
}

export async function loadSeedJournalCaseReveal(caseId: string, presentationId: string) {
  const evaluationCase = (await loadSeedJournalCases({ reveal: true }))
    .find((item) => item.case_id === caseId);
  if (!evaluationCase || evaluationCase.presentation_id !== presentationId) return null;
  return evaluationCase;
}
