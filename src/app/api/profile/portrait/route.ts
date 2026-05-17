import { NextResponse } from "next/server";

import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import {
  getPortraitSnapshot,
  synthesizePortrait
} from "@/server/services/portrait/portrait-synthesis.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const snapshot = await getPortraitSnapshot(user.id);

    if (!snapshot) {
      return NextResponse.json({ snapshot: null });
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        summary: snapshot.summary,
        dimensionInsights: snapshot.dimensionInsights,
        factCount: snapshot.factCount,
        generatedAt: snapshot.generatedAt.toISOString()
      }
    });
  } catch {
    return NextResponse.json({ error: "PORTRAIT_QUERY_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await synthesizePortrait(user.id);

    if (!result) {
      return NextResponse.json(
        { error: "PORTRAIT_SYNTHESIS_FAILED", message: "数据不足或 AI 服务不可用" },
        { status: 422 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "PORTRAIT_SYNTHESIS_FAILED" }, { status: 500 });
  }
}
