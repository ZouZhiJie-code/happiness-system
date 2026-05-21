import { logger } from "@/server/lib/logger";
import type { AIProvider } from "@/server/services/ai/ai-provider";
import { VolcengineArkProvider } from "@/server/services/ai/volcengine-ark.provider";

let hasLoggedProviderReady = false;

export function getAIProvider(): AIProvider | null {
  const provider = (process.env.AI_PROVIDER ?? "volcengine-ark").toLowerCase();

  if (provider === "disabled") {
    return null;
  }

  if (provider === "volcengine-ark" || provider === "ark") {
    try {
      const aiProvider = new VolcengineArkProvider();

      if (!hasLoggedProviderReady) {
        logger.info(
          {
            provider: aiProvider.name,
            modelConfigured: Boolean(
              process.env.VOLCENGINE_ARK_MODEL ??
                process.env.ARK_MODEL ??
                process.env.VOLCENGINE_ARK_ENDPOINT_ID ??
                process.env.ARK_ENDPOINT_ID
            )
          },
          "AI provider initialized successfully."
        );
        hasLoggedProviderReady = true;
      }

      return aiProvider;
    } catch (error) {
      logger.warn(
        {
          err: error,
          provider
        },
        "AI provider initialization failed, fallback logic will be used."
      );

      return null;
    }
  }

  logger.warn({ provider }, "Unknown AI provider configured, fallback logic will be used.");

  return null;
}
