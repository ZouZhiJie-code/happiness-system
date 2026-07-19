import { createHash } from "node:crypto";

import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type { InterviewDimension } from "@/types/interview";

export const PROMPT_MANIFEST_VERSION = "2026-07-19.1";

export type PromptEnvelope = {
  promptKey: string;
  promptVersion: string;
  messages: AIChatMessage[];
  resolvedPromptHash: string;
};

export function hashPromptContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPromptEnvelope(input: {
  promptKey: string;
  promptVersion?: string;
  messages: AIChatMessage[] | null | undefined;
}): PromptEnvelope {
  const promptVersion = input.promptVersion ?? PROMPT_MANIFEST_VERSION;
  const messages = input.messages ?? [];

  return {
    promptKey: input.promptKey,
    promptVersion,
    messages,
    resolvedPromptHash: hashPromptContent(JSON.stringify(messages))
  };
}

export function getInterviewPromptKey(
  stage: "extract" | "question" | "journal",
  dimension: InterviewDimension
) {
  return `interview.${stage}.${dimension}`;
}

export function getDeterministicPromptKey(kind: "opening" | "choice" | "repair" | "fallback") {
  return `interview.deterministic.${kind}`;
}
