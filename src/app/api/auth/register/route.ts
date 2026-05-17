import { NextResponse } from "next/server";

import { authSessionResponseSchema, registerRequestSchema } from "@/features/auth/auth.schema";
import { AuthenticationError, registerUser } from "@/server/services/auth/auth.service";
import { buildAuthCookieOptions } from "@/server/services/auth/auth-cookie";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REGISTER_REQUEST" }, { status: 400 });
  }

  try {
    const result = await registerUser(parsed.data);
    const response = NextResponse.json(
      authSessionResponseSchema.parse({
        authenticated: true,
        user: result.user
      })
    );

    response.cookies.set("dl_session", result.token, buildAuthCookieOptions());

    return response;
  } catch (error) {
    if (error instanceof AuthenticationError && error.message === "USERNAME_ALREADY_EXISTS") {
      return NextResponse.json({ error: "USERNAME_ALREADY_EXISTS" }, { status: 409 });
    }

    if (error instanceof AuthenticationError && error.message === "AUTH_STORAGE_NOT_READY") {
      return NextResponse.json({ error: "AUTH_STORAGE_NOT_READY" }, { status: 503 });
    }

    return NextResponse.json({ error: "REGISTER_FAILED" }, { status: 500 });
  }
}
