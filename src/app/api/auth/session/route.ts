import { NextResponse } from "next/server";

import { authSessionResponseSchema } from "@/features/auth/auth.schema";
import { getCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  const user = await getCurrentUserFromRequest(request);

  return NextResponse.json(
    authSessionResponseSchema.parse({
      authenticated: Boolean(user),
      user
    })
  );
}

