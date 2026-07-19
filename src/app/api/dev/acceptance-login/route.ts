import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { normalizeAuthRedirectPath } from "@/features/auth/auth-local";
import { AUTH_SESSION_TTL_SECONDS } from "@/features/auth/auth.constants";
import { findUserByUsername, createAuthSession } from "@/server/repositories/auth.repository";
import { buildAuthCookieOptions } from "@/server/services/auth/auth-cookie";
import { createSessionToken } from "@/server/services/auth/session-token.service";

export const runtime = "nodejs";

const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$|^\[::1\](?::\d{1,5})?$/i;

function getForwardedHost(request: Request) {
  return (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    LOCAL_HOST_PATTERN.test(getForwardedHost(request))
  );
}

function getLocalRedirectOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = getForwardedHost(request);
  if (!LOCAL_HOST_PATTERN.test(forwardedHost)) {
    return requestUrl.origin;
  }

  const forwardedProtocol = (request.headers.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    ?.trim();
  const protocol = forwardedProtocol === "https" ? "https:" : requestUrl.protocol;
  return `${protocol}//${forwardedHost}`;
}

function secureTokenMatch(actual: string, expected: string) {
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" || !isLocalRequest(request)) {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(request.url);
  const expectedToken = process.env.ACCEPTANCE_LOGIN_TOKEN ?? "local-ai-quality-acceptance";
  if (!secureTokenMatch(url.searchParams.get("token") ?? "", expectedToken)) {
    return new NextResponse(null, { status: 404 });
  }

  const username = process.env.ACCEPTANCE_ADMIN_USERNAME ?? "acceptance_admin";
  const user = await findUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "ACCEPTANCE_ADMIN_NOT_SEEDED" }, { status: 503 });
  }

  const token = await createSessionToken();
  await createAuthSession({
    userId: user.id,
    tokenHash: token.hash,
    expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000)
  });

  const redirectPath = normalizeAuthRedirectPath(url.searchParams.get("redirect") ?? "/admin/ai-quality");
  const response = NextResponse.redirect(new URL(redirectPath, getLocalRedirectOrigin(request)), 303);
  response.cookies.set("dl_session", token.value, buildAuthCookieOptions());
  return response;
}
