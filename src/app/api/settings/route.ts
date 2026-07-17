import { NextResponse } from "next/server";

import { settingsFormSchema } from "@/features/interview/schema/interview.schema";
import { getUserMemorySettings, updateUserMemorySettings } from "@/server/repositories/user-settings.repository";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    return NextResponse.json(await getUserMemorySettings(user.id));
  } catch (error) {
    return NextResponse.json(
      { error: isAuthenticationRequiredError(error) ? "AUTHENTICATION_REQUIRED" : "SETTINGS_QUERY_FAILED" },
      { status: isAuthenticationRequiredError(error) ? 401 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const parsed = settingsFormSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_SETTINGS_REQUEST" }, { status: 400 });
    }

    return NextResponse.json(await updateUserMemorySettings(user.id, parsed.data.memoryEnabled));
  } catch (error) {
    return NextResponse.json(
      { error: isAuthenticationRequiredError(error) ? "AUTHENTICATION_REQUIRED" : "SETTINGS_UPDATE_FAILED" },
      { status: isAuthenticationRequiredError(error) ? 401 : 500 }
    );
  }
}
