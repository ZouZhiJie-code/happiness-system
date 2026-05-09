import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

const DEMO_USER_ID = "local-demo-user";

export async function DELETE() {
  const database = prisma as any;

  try {
    await database.$transaction(async (tx: any) => {
      // Collect session IDs inside the transaction to ensure consistency
      const sessions = await tx.interviewSession.findMany({
        where: { userId: DEMO_USER_ID },
        select: { id: true }
      });
      const sessionIds = sessions.map((s: { id: string }) => s.id);

      // 防御性显式删除：虽然 schema 定义了 onDelete: Cascade，
      // 但显式先删子表数据可以避免级联删除失败或部分执行的风险
      await tx.aIRequestLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.joyInterviewSnapshot.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.interviewMessage.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.interviewEvent.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.interviewSession.deleteMany({ where: { userId: DEMO_USER_ID } });

      // Tables linked directly to User
      await tx.joyEntry.deleteMany({ where: { userId: DEMO_USER_ID } });
      await tx.dailyJournalEntry.deleteMany({ where: { userId: DEMO_USER_ID } });
      await tx.dailyHappinessScore.deleteMany({ where: { userId: DEMO_USER_ID } });
      await tx.memoryFact.deleteMany({ where: { userId: DEMO_USER_ID } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Data deletion failed:", error);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
