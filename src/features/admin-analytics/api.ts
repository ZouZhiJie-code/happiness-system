import { parseEntryDateInput } from "@/features/interview/entry-date";
import type { AdminAnalyticsRange } from "@/features/admin-analytics/types";

export class AdminAnalyticsApiRequestError extends Error {
  constructor(
    readonly code: "INVALID_ADMIN_ANALYTICS_RANGE",
    message?: string
  ) {
    super(message ?? code);
    this.name = "AdminAnalyticsApiRequestError";
  }
}

function getRequiredQueryParam(request: Request, key: string) {
  const { searchParams } = new URL(request.url);
  return searchParams.get(key)?.trim() ?? "";
}

export function parseAdminAnalyticsRangeQuery(request: Request): AdminAnalyticsRange {
  const startDate = getRequiredQueryParam(request, "startDate");
  const endDate = getRequiredQueryParam(request, "endDate");

  if (!startDate || !endDate) {
    throw new AdminAnalyticsApiRequestError("INVALID_ADMIN_ANALYTICS_RANGE");
  }

  try {
    const start = parseEntryDateInput(startDate).getTime();
    const end = parseEntryDateInput(endDate).getTime();

    if (start > end) {
      throw new AdminAnalyticsApiRequestError("INVALID_ADMIN_ANALYTICS_RANGE");
    }
  } catch {
    throw new AdminAnalyticsApiRequestError("INVALID_ADMIN_ANALYTICS_RANGE");
  }

  return {
    startDate,
    endDate
  };
}
