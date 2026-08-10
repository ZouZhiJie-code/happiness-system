import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const runId = params.get("runId") ?? "";
  const taskId = params.get("taskId");
  return withGi088Evaluation(request, ({ ownerUserId, service }) =>
    service.getSession({ ownerUserId, runId, taskId })
  );
}
