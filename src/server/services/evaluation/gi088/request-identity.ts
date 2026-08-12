import { createHash } from "node:crypto";

import type { AICompletionParams } from "@/server/services/ai/ai-provider";
import {
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_MODEL_CALL_IDENTITY
} from "@/server/services/evaluation/gi088/candidate";

export const GI088_MODEL_REQUEST_IDENTITY = {
  ...GI088_MODEL_CALL_IDENTITY,
  transport: GI088_ARK_FLASH_RUNTIME_POLICY.transport
} as const;

export function createGi088ModelRequestHash(
  params: AICompletionParams,
  context?: {
    emptyContentRecoveryPolicyVersion?: string | null;
    emptyContentAutomaticRetries?: number | null;
    emptyContentPolicyOverride?: boolean | null;
    adaptiveRecoveryPolicyVersion?: string | null;
    raceContractVersion?: string | null;
    raceGroupId?: string | null;
    recoveryRole?: string | null;
    raceTrigger?: string | null;
    accelerationAfterMs?: number | null;
    turnHardDeadlineMs?: number | null;
    remainingTurnDeadlineMs?: number | null;
    maximumAutomaticProviderCallsPerCycle?: number | null;
  }
) {
  return createHash("sha256")
    .update(JSON.stringify({
      requestIdentity: GI088_MODEL_REQUEST_IDENTITY,
      params,
      ...(context ? { recoveryPolicy: context } : {})
    }))
    .digest("hex");
}
