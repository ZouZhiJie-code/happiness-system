import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

const DEMO_USER_ID = "local-demo-user";

export async function GET() {
  const database = prisma as any;

  try {
    const [joyEntries, dailyJournalEntries] = await Promise.all([
      database.joyEntry.findMany({
        where: { userId: DEMO_USER_ID },
        orderBy: { date: "desc" },
        take: 1000
      }),
      database.dailyJournalEntry.findMany({
        where: { userId: DEMO_USER_ID },
        orderBy: { date: "desc" },
        take: 1000
      })
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      joyEntries,
      dailyJournalEntries
    };

    const json = JSON.stringify(payload, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="happiness-export-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  } catch (error) {
    console.error("Export failed:", error);
    return NextResponse.json({ error: "EXPORT_FAILED" }, { status: 500 });
  }
}
