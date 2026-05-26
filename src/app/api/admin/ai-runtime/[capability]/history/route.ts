import { NextResponse } from "next/server";

import { resolveCapabilityParam, sanitizeAIRuntimeConfig, toAdminAIRuntimeErrorResponse } from "@/app/api/admin/ai-runtime/_shared";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { getAIRuntimeHistory } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export async function GET(request: Request, context: { params: Promise<{ capability: string }> }) {
  try {
    await requireAdminRequest(request);
    const capability = await resolveCapabilityParam(context.params);
    const history = await getAIRuntimeHistory(capability);

    return NextResponse.json({
      history: history.map(sanitizeAIRuntimeConfig)
    });
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}
