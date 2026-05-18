import { NextResponse } from "next/server";

import { authSessionResponseSchema, loginRequestSchema } from "@/features/auth/auth.schema";
import { AuthenticationError, loginUser } from "@/server/services/auth/auth.service";
import { buildAuthCookieOptions } from "@/server/services/auth/auth-cookie";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_LOGIN_REQUEST" }, { status: 400 });
  }

  try {
    const result = await loginUser(parsed.data);
    const response = NextResponse.json(
      authSessionResponseSchema.parse({
        authenticated: true,
        user: result.user
      })
    );

    response.cookies.set("dl_session", result.token, buildAuthCookieOptions());

    return response;
  } catch (error) {
    if (error instanceof AuthenticationError && error.message === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    if (error instanceof AuthenticationError && error.message === "AUTH_STORAGE_NOT_READY") {
      return NextResponse.json({ error: "AUTH_STORAGE_NOT_READY" }, { status: 503 });
    }

    return NextResponse.json({ error: "LOGIN_FAILED" }, { status: 500 });
  }
}
