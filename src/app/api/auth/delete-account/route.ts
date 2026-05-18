import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { deleteAccountRequestSchema } from "@/features/auth/auth.schema";
import { AuthenticationError, deleteAccount } from "@/server/services/auth/auth.service";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const body = await request.json();
    const parsed = deleteAccountRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_DELETE_ACCOUNT_REQUEST" }, { status: 400 });
    }

    await deleteAccount(user.id, parsed.data.password);

    const response = NextResponse.json({ success: true, userId: user.id });
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    if (error instanceof AuthenticationError && error.message === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    return NextResponse.json({ error: "DELETE_ACCOUNT_FAILED" }, { status: 500 });
  }
}
