import { NextResponse } from "next/server";

import {
  getPortraitSnapshot,
  synthesizePortrait
} from "@/server/services/portrait/portrait-synthesis.service";

export async function GET() {
  try {
    const snapshot = await getPortraitSnapshot();

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

export async function POST() {
  try {
    const result = await synthesizePortrait();

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
