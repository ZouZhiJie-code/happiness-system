import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "INTENT_OBSERVATION_NOT_AVAILABLE" },
      { status: 404 }
    );
  }

  try {
    await requireAdminRequest(request);

    const latestTurns = await prisma.interviewUserTurn.findMany({
      where: {
        clientTurnId: { startsWith: "intent-observation-" }
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        clientTurnId: true,
        sessionId: true,
        status: true,
        attemptCount: true,
        intentAssessment: true,
        intentClassifierVersion: true,
        intentDecision: true,
        intentAssessedAt: true,
        createdAt: true,
        messages: {
          where: { role: "assistant" },
          select: { generationTraceId: true }
        },
        session: {
          select: {
            dimension: true,
            stage: true,
            status: true,
            turnCount: true,
            activeEvent: {
              select: { snapshotData: true }
            }
          }
        }
      }
    });

    const traceIds = latestTurns
      .flatMap((turn) => turn.messages)
      .map((message) => message.generationTraceId)
      .filter((traceId): traceId is string => Boolean(traceId));
    const [traces, requests] = await Promise.all([
      prisma.aIGenerationTrace.findMany({
        where: { id: { in: traceIds } },
        select: {
          id: true,
          status: true,
          outputOrigin: true,
          pipelineDecisions: true,
          createdAt: true,
          completedAt: true
        }
      }),
      prisma.aIRequestLog.findMany({
        where: {
          traceId: { in: traceIds },
          stage: "extract"
        },
        select: {
          traceId: true,
          success: true,
          latencyMs: true,
          errorCode: true
        }
      })
    ]);
    const tracesById = new Map(traces.map((trace) => [trace.id, trace]));
    const requestsByTraceId = new Map<string, typeof requests>();

    for (const providerRequest of requests) {
      if (!providerRequest.traceId) continue;
      const current = requestsByTraceId.get(providerRequest.traceId) ?? [];
      current.push(providerRequest);
      requestsByTraceId.set(providerRequest.traceId, current);
    }

    return NextResponse.json({
      reportVersion: "interview-intent-preview-observation-v1",
      generatedAt: new Date().toISOString(),
      total: latestTurns.length,
      turns: latestTurns
        .map((turn) => {
          const traceId = turn.messages.find(
            (message) => message.generationTraceId
          )?.generationTraceId;
          const trace = traceId ? tracesById.get(traceId) : null;
          const extractRequests = traceId
            ? requestsByTraceId.get(traceId) ?? []
            : [];

          return {
            clientTurnId: turn.clientTurnId,
            sessionId: turn.sessionId,
            status: turn.status,
            attemptCount: turn.attemptCount,
            intentAssessment: turn.intentAssessment,
            intentClassifierVersion: turn.intentClassifierVersion,
            intentDecision: turn.intentDecision,
            intentAssessedAt: turn.intentAssessedAt?.toISOString() ?? null,
            createdAt: turn.createdAt.toISOString(),
            session: {
              dimension: turn.session.dimension,
              stage: turn.session.stage,
              status: turn.session.status,
              turnCount: turn.session.turnCount,
              snapshotData: turn.session.activeEvent?.snapshotData ?? null
            },
            trace: trace
              ? {
                  status: trace.status,
                  outputOrigin: trace.outputOrigin,
                  pipelineDecisions: trace.pipelineDecisions,
                  latencyMs: trace.completedAt
                    ? trace.completedAt.getTime() - trace.createdAt.getTime()
                    : null
                }
              : null,
            extractRequests
          };
        })
        .reverse()
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
    }

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { error: "AUTHENTICATION_REQUIRED" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "INTENT_OBSERVATION_READ_FAILED" },
      { status: 500 }
    );
  }
}
