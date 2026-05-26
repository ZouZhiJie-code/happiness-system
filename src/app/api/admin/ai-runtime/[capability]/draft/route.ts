import { NextResponse } from "next/server";

import { resolveCapabilityParam, sanitizeAIRuntimeConfig, toAdminAIRuntimeErrorResponse } from "@/app/api/admin/ai-runtime/_shared";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { getAIRuntimeDraft, saveAIRuntimeDraft } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export async function GET(request: Request, context: { params: Promise<{ capability: string }> }) {
  try {
    await requireAdminRequest(request);
    const capability = await resolveCapabilityParam(context.params);
    const draft = await getAIRuntimeDraft(capability);

    return NextResponse.json({
      draft: sanitizeAIRuntimeConfig(draft)
    });
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ capability: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const capability = await resolveCapabilityParam(context.params);
    const body = await request.json();
    const draft = await saveAIRuntimeDraft({
      capability,
      actorUsername: admin.username,
      input: body
    });

    return NextResponse.json({
      draft: sanitizeAIRuntimeConfig(draft)
    });
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}
