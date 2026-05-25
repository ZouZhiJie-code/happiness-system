import { NextResponse } from "next/server";

import { resolveCapabilityParam, sanitizeAIRuntimeProbe, toAdminAIRuntimeErrorResponse } from "@/app/api/admin/ai-runtime/_shared";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { probeAIRuntimeDraft } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export async function POST(request: Request, context: { params: Promise<{ capability: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const capability = await resolveCapabilityParam(context.params);
    const probe = await probeAIRuntimeDraft({
      capability,
      actorUsername: admin.username
    });

    return NextResponse.json({
      probe: sanitizeAIRuntimeProbe(probe)
    });
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}
