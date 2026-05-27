import { NextResponse } from "next/server";

import { authSessionResponseSchema, loginRequestSchema } from "@/features/auth/auth.schema";
import { normalizeAuthRedirectPath } from "@/features/auth/auth-local";
import { AuthenticationError, loginUser } from "@/server/services/auth/auth.service";
import { buildAuthCookieOptions } from "@/server/services/auth/auth-cookie";

async function parseLoginRequestBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return {
      submissionKind: "json" as const,
      body: await request.json()
    };
  }

  if (
    contentType.includes("application/x-www-form-urlencoded")
    || contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return {
      submissionKind: "form" as const,
      body: {
        username: formData.get("username"),
        password: formData.get("password")
      },
      nextPath: formData.get("next")
    };
  }

  return {
    submissionKind: "json" as const,
    body: await request.json()
  };
}

export async function POST(request: Request) {
  let payload:
    | {
        submissionKind: "json";
        body: unknown;
      }
    | {
        submissionKind: "form";
        body: unknown;
        nextPath: FormDataEntryValue | null;
      };

  try {
    payload = await parseLoginRequestBody(request);
  } catch {
    return NextResponse.json({ error: "INVALID_LOGIN_REQUEST" }, { status: 400 });
  }

  const parsed = loginRequestSchema.safeParse(payload.body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_LOGIN_REQUEST" }, { status: 400 });
  }

  try {
    const result = await loginUser(parsed.data);
    const response =
      payload.submissionKind === "form"
        ? NextResponse.redirect(
            new URL(
              normalizeAuthRedirectPath(
                typeof payload.nextPath === "string" ? payload.nextPath : null
              ),
              request.url
            ),
            303
          )
        : NextResponse.json(
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
