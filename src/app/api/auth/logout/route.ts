import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { logoutUser } from "@/server/services/auth/auth.service";

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const segment = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!segment) {
    return null;
  }

  return segment.slice(name.length + 1) || null;
}

export async function POST(request: Request) {
  const currentToken = readCookie(request, AUTH_COOKIE_NAME);

  if (currentToken) {
    await logoutUser(currentToken);
  }

  const response = NextResponse.json({ authenticated: false, user: null });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
