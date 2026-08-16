import { redirect } from "next/navigation";

type LegacyAnalysisPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function legacyMonthBounds(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/u.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  const endDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  return {
    startDate: `${value}-01`,
    endDate: `${value}-${String(endDay).padStart(2, "0")}`
  };
}

export default async function AnalysisPage({ searchParams }: LegacyAnalysisPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams({ section: "trends" });

  const preset = readFirst(resolved.preset);
  const month = readFirst(resolved.month);
  const startDate = readFirst(resolved.startDate) ?? readFirst(resolved.start);
  const endDate = readFirst(resolved.endDate) ?? readFirst(resolved.end);

  const monthBounds = legacyMonthBounds(month);
  if (startDate && endDate) {
    params.set("preset", "custom");
    params.set("startDate", startDate);
    params.set("endDate", endDate);
  } else if (monthBounds) {
    params.set("preset", "custom");
    params.set("startDate", monthBounds.startDate);
    params.set("endDate", monthBounds.endDate);
  } else if (preset) {
    params.set("preset", preset);
  }

  redirect(`/insights?${params.toString()}`);
}
