import { NextResponse } from "next/server";

import { aiQualityConsentSchema } from "@/features/ai-feedback/feedback-config";
import { getAIQualityConsentState, updateAIQualityConsent } from "@/server/services/ai-quality/ai-feedback.service";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    return NextResponse.json(await getAIQualityConsentState(user.id));
  } catch (error) {
    return NextResponse.json(
      { error: isAuthenticationRequiredError(error) ? "AUTHENTICATION_REQUIRED" : "CONSENT_QUERY_FAILED" },
      { status: isAuthenticationRequiredError(error) ? 401 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const parsed = aiQualityConsentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_CONSENT_REQUEST" }, { status: 400 });
    if (!parsed.data.participate) {
      return NextResponse.json({ error: "AI_QUALITY_PARTICIPATION_REQUIRED" }, { status: 409 });
    }
    return NextResponse.json(await updateAIQualityConsent(user.id, parsed.data.participate));
  } catch (error) {
    return NextResponse.json(
      { error: isAuthenticationRequiredError(error) ? "AUTHENTICATION_REQUIRED" : "CONSENT_UPDATE_FAILED" },
      { status: isAuthenticationRequiredError(error) ? 401 : 500 }
    );
  }
}
