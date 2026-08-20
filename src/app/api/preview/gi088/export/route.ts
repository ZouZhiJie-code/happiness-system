import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId") ?? "";
  return withGi088Evaluation(request, ({ ownerUserId, service }) =>
    service.exportRun({ ownerUserId, runId })
  );
}
