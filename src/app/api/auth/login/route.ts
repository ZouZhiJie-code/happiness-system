import { NextResponse } from "next/server";

import { authSessionResponseSchema, loginRequestSchema } from "@/features/auth/auth.schema";
import { AuthenticationError, loginUser } from "@/server/services/auth/auth.service";
import { buildAuthCookieOptions } from "@/server/services/auth/auth-cookie";

async function parseLoginRequestBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded")
    || contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return {
      username: formData.get("username"),
      password: formData.get("password")
    };
  }

  return request.json();
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await parseLoginRequestBody(request);
  } catch {
    return NextResponse.json({ error: "INVALID_LOGIN_REQUEST" }, { status: 400 });
  }

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
