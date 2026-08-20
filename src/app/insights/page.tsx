import { InsightsWorkspaceView } from "@/components/insights";
import { getInsightsSelf, getInsightsTrends } from "@/server/services/insights";
import { InsightsRangeError } from "@/server/services/insights/date-range";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";
import type { InsightsSection } from "@/types/insights";

type InsightsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function normalizeSection(value: string | null): InsightsSection {
  return value === "portrait" || value === "memories" ? value : "trends";
}

function buildReturnHref(params: Record<string, string | string[] | undefined>) {
  const output = new URLSearchParams();
  ["section", "preset", "startDate", "endDate"].forEach((key) => {
    const value = stringParam(params[key]);
    if (value) output.set(key, value);
  });
  return output.size > 0 ? `/insights?${output.toString()}` : "/insights";
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const params = searchParams ? await searchParams : {};
  const section = normalizeSection(stringParam(params.section));
  const user = await requireAuthenticatedPage(buildReturnHref(params));
  const trendsRequest = getInsightsTrends(user.id, {
      preset: stringParam(params.preset),
      startDate: stringParam(params.startDate),
      endDate: stringParam(params.endDate)
    }).catch((error: unknown) => {
      if (!(error instanceof InsightsRangeError)) throw error;
      return getInsightsTrends(user.id, { preset: "month" });
    });
  const [trends, self] = await Promise.all([trendsRequest, getInsightsSelf(user.id)]);
  const rangeParams = new URLSearchParams({ section: "trends", preset: trends.range.preset });
  if (trends.range.preset === "custom") {
    rangeParams.set("startDate", trends.range.startDate);
    rangeParams.set("endDate", trends.range.endDate);
  }

  return (
    <InsightsWorkspaceView
      section={section}
      trends={trends}
      self={self}
      sectionHrefs={{
        trends: `/insights?${rangeParams.toString()}`,
        portrait: "/insights?section=portrait",
        memories: "/insights?section=memories"
      }}
    />
  );
}
