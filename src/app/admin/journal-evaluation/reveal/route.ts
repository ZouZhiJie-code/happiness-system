import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "SYNTHETIC_HUMAN_REVIEW_RETIRED" }, { status: 404 });
}
