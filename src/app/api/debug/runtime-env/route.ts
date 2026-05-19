import { NextResponse } from "next/server";

import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

function readEnvValue(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

function toHttpsUrl(host: string | null) {
  return host ? `https://${host}` : null;
}

export async function GET(request: Request) {
  try {
    if (process.env.ENABLE_RUNTIME_ENV_READBACK !== "1") {
      return NextResponse.json({ error: "RUNTIME_ENV_READBACK_DISABLED" }, { status: 404 });
    }

    const expectedToken = readEnvValue("RUNTIME_ENV_READBACK_TOKEN");

    if (!expectedToken) {
      return NextResponse.json({ error: "RUNTIME_ENV_READBACK_NOT_CONFIGURED" }, { status: 503 });
    }

    const providedToken = request.headers.get("x-runtime-readback-token");

    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: "RUNTIME_ENV_READBACK_FORBIDDEN" }, { status: 403 });
    }

    await requireCurrentUserFromRequest(request);

    const env = {
      VERCEL: readEnvValue("VERCEL"),
      VERCEL_TARGET_ENV: readEnvValue("VERCEL_TARGET_ENV"),
      VERCEL_URL: readEnvValue("VERCEL_URL"),
      VERCEL_BRANCH_URL: readEnvValue("VERCEL_BRANCH_URL"),
      VERCEL_PROJECT_PRODUCTION_URL: readEnvValue("VERCEL_PROJECT_PRODUCTION_URL"),
      VERCEL_DEPLOYMENT_ID: readEnvValue("VERCEL_DEPLOYMENT_ID"),
      APP_URL: readEnvValue("APP_URL")
    };

    return NextResponse.json({
      requestHost: new URL(request.url).host,
      env,
      resolved: {
        deploymentUrl: toHttpsUrl(env.VERCEL_URL),
        branchUrl: toHttpsUrl(env.VERCEL_BRANCH_URL),
        projectProductionUrl: toHttpsUrl(env.VERCEL_PROJECT_PRODUCTION_URL),
        appUrl: env.APP_URL
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    return NextResponse.json({ error: "RUNTIME_ENV_READBACK_FAILED" }, { status: 500 });
  }
}
