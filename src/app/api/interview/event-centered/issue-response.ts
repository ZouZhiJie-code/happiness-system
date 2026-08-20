import { NextResponse } from "next/server";

import { createInterviewRequestId } from "@/server/services/interview/respond-error";

export type EventCenteredRouteIssue = {
  code: string;
  title: string;
  message: string;
  resolution: string;
  retryable: boolean;
  action: string;
};

export function createEventCenteredRouteRequestId() {
  return createInterviewRequestId();
}

export function eventCenteredIssueResponse(input: {
  issue: EventCenteredRouteIssue;
  requestId: string;
  status: number;
  details?: Record<string, unknown>;
}) {
  const issue = { ...input.issue, requestId: input.requestId };
  return NextResponse.json(
    {
      error: issue.code,
      message: issue.message,
      issue,
      ...input.details
    },
    { status: input.status }
  );
}
