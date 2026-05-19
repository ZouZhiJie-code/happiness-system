#!/usr/bin/env node

const rawBaseUrl = process.env.SMOKE_BASE_URL ?? process.argv[2];
const bypassSecret = process.env.SMOKE_BYPASS_SECRET ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

if (!rawBaseUrl) {
  console.error("Usage: SMOKE_BASE_URL=https://preview-url npm run smoke:public");
  console.error("   or: npm run smoke:public -- https://preview-url");
  process.exit(1);
}

const baseUrl = rawBaseUrl.replace(/\/+$/, "");

const checks = [
  { path: "/", expectedStatus: 200, label: "homepage" },
  { path: "/login", expectedStatus: 200, label: "login page" },
  { path: "/register", expectedStatus: 200, label: "register page" },
  { path: "/legal/terms", expectedStatus: 200, label: "terms page" },
  { path: "/legal/privacy", expectedStatus: 200, label: "privacy page" },
  { path: "/api/auth/session", expectedStatus: 200, label: "auth session endpoint", expectJson: true }
];

function extractCookie(headerValue, cookieName) {
  const match = headerValue.match(new RegExp(`${cookieName}=[^;]+`));
  return match ? match[0] : "";
}

async function getProtectionCookieHeader() {
  if (!bypassSecret) {
    return "";
  }

  const bypassUrl = new URL("/", `${baseUrl}/`);
  bypassUrl.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  bypassUrl.searchParams.set("x-vercel-set-bypass-cookie", "true");

  const response = await fetch(bypassUrl, {
    method: "GET",
    redirect: "manual"
  });

  const setCookieHeader = response.headers.get("set-cookie") ?? "";
  const cookieHeader = extractCookie(setCookieHeader, "_vercel_jwt");

  if (!cookieHeader) {
    throw new Error("failed to obtain Vercel protection bypass cookie");
  }

  return cookieHeader;
}

async function runCheck(check, cookieHeader) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: "GET",
    redirect: "manual",
    headers: cookieHeader
      ? {
          cookie: cookieHeader
        }
      : undefined
  });

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (response.status !== check.expectedStatus) {
    throw new Error(`${check.label} returned ${response.status}, expected ${check.expectedStatus}`);
  }

  if (check.expectJson) {
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`${check.label} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (typeof parsed?.authenticated !== "boolean") {
      throw new Error(`${check.label} JSON is missing boolean field \"authenticated\"`);
    }

    return {
      path: check.path,
      status: response.status,
      contentType,
      authenticated: parsed.authenticated
    };
  }

  if (!text.trim()) {
    throw new Error(`${check.label} returned an empty body`);
  }

  return {
    path: check.path,
    status: response.status,
    contentType
  };
}

async function main() {
  const cookieHeader = await getProtectionCookieHeader();
  const results = [];

  for (const check of checks) {
    const result = await runCheck(check, cookieHeader);
    results.push(result);
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        protectionBypassEnabled: Boolean(cookieHeader),
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[http-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
