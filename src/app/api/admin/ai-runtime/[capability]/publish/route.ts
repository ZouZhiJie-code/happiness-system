import { NextResponse } from "next/server";

import { resolveCapabilityParam, sanitizeAIRuntimeConfig, toAdminAIRuntimeErrorResponse } from "@/app/api/admin/ai-runtime/_shared";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { publishAIRuntimeDraft } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export async function POST(request: Request, context: { params: Promise<{ capability: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const capability = await resolveCapabilityParam(context.params);
    const publishedConfig = await publishAIRuntimeDraft({
      capability,
      actorUsername: admin.username
    });

    return NextResponse.json({
      publishedConfig: sanitizeAIRuntimeConfig(publishedConfig)
    });
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}
