import { NextResponse } from "next/server";

import { resolveCapabilityParam, sanitizeAIRuntimeConfig, toAdminAIRuntimeErrorResponse } from "@/app/api/admin/ai-runtime/_shared";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { rollbackAIRuntimeConfig } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export async function POST(request: Request, context: { params: Promise<{ capability: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const capability = await resolveCapabilityParam(context.params);
    const body = (await request.json()) as {
      rollbackFromId?: string;
    };
    const rolledBackConfig = await rollbackAIRuntimeConfig({
      capability,
      actorUsername: admin.username,
      rollbackFromId: body.rollbackFromId ?? ""
    });

    return NextResponse.json({
      rolledBackConfig: sanitizeAIRuntimeConfig(rolledBackConfig)
    });
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}
