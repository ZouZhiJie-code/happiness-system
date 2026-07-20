import type { PromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { hashPromptContent } from "@/features/ai-quality/prompt-manifest";
import { buildFewShotFingerprint } from "@/features/ai-quality/impact-policy";
import { loadActivePromptOptimization } from "@/server/repositories/ai-optimization.repository";
import { logger } from "@/server/lib/logger";

function readInstructionPatch(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const patch = (value as Record<string, unknown>).instructionPatch;
  return typeof patch === "string" && patch.trim() ? patch.trim() : null;
}

export async function resolveOptimizedPromptEnvelope(base: PromptEnvelope): Promise<PromptEnvelope> {
  try {
    const optimization = await loadActivePromptOptimization(base.promptKey);
    const instructionPatch = readInstructionPatch(optimization.promptCandidate?.proposal);
    const examples = optimization.fewShotExamples;

    if (!instructionPatch && examples.length === 0) return base;

    const messages = [...base.messages];
    const systemIndex = messages.findIndex((message) => message.role === "system");
    if (instructionPatch) {
      const patchText = `\n\n[已审核质量补丁]\n${instructionPatch}`;
      if (systemIndex >= 0) {
        messages[systemIndex] = { ...messages[systemIndex], content: `${messages[systemIndex].content}${patchText}` };
      } else {
        messages.unshift({ role: "system", content: patchText.trim() });
      }
    }

    const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
    const insertionIndex = lastUserIndex >= 0 ? lastUserIndex : messages.length;
    const exampleMessages = examples.flatMap((example) => [
      { role: "user" as const, content: `[高质量参考上下文]\n${JSON.stringify(example.inputSnapshot)}` },
      { role: "assistant" as const, content: JSON.stringify(example.output) }
    ]);
    messages.splice(insertionIndex, 0, ...exampleMessages);

    const exampleFingerprint = buildFewShotFingerprint(examples.map((example) => example.id));
    const promptVersion = `${base.promptVersion}+opt:${optimization.promptCandidate?.id ?? "none"}+fs:${exampleFingerprint}`;

    return {
      ...base,
      promptVersion,
      messages,
      resolvedPromptHash: hashPromptContent(JSON.stringify(messages))
    };
  } catch (error) {
    logger.warn({ err: error, promptKey: base.promptKey }, "Active prompt optimization could not be loaded.");
    return base;
  }
}
