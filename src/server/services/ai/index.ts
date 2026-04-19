import { logger } from "@/server/lib/logger";
import type { AIProvider } from "@/server/services/ai/ai-provider";
import { VolcengineArkProvider } from "@/server/services/ai/volcengine-ark.provider";

export function getAIProvider(): AIProvider | null {
  const provider = (process.env.AI_PROVIDER ?? "volcengine-ark").toLowerCase();

  if (provider === "disabled") {
    return null;
  }

  if (provider === "volcengine-ark" || provider === "ark") {
    try {
      return new VolcengineArkProvider();
    } catch (error) {
      logger.warn(
        {
          err: error
        },
        "AI provider is not available, fallback logic will be used."
      );

      return null;
    }
  }

  logger.warn({ provider }, "Unknown AI provider configured, fallback logic will be used.");

  return null;
}
