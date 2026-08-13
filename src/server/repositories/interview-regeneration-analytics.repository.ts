import { prisma } from "@/server/db/prisma";

export function findInterviewRegenerationsForMetrics(input: {
  periodStart: Date;
  periodEnd: Date;
}) {
  return prisma.aIResponseRegeneration.findMany({
    where: {
      createdAt: {
        gte: input.periodStart,
        lt: input.periodEnd
      },
      rootSession: {
        mode: "dimension_legacy",
        dimension: { not: null }
      }
    },
    select: {
      intent: true,
      status: true,
      latencyMs: true,
      answeredAt: true,
      replacedAt: true,
      switchedBackAt: true,
      downvotedAt: true,
      abandonedAt: true,
      generatedTrace: {
        select: {
          outputOrigin: true
        }
      },
      rootSession: {
        select: {
          dimension: true
        }
      },
      sourceMessage: {
        select: {
          content: true
        }
      }
    }
  });
}
