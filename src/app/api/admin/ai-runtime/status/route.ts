import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { getAdminAIRuntimeStatus } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";
import { sanitizeAIRuntimeStatusPayload, toAdminAIRuntimeErrorResponse } from "@/app/api/admin/ai-runtime/_shared";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const payload = await getAdminAIRuntimeStatus();

    return NextResponse.json(sanitizeAIRuntimeStatusPayload(payload));
  } catch (error) {
    return toAdminAIRuntimeErrorResponse(error);
  }
}
