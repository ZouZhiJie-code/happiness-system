import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  DailyLightVisualReview,
  type DailyLightVisualReviewScreen
} from "@/components/preview/daily-light-visual-review";

const VISUAL_REVIEW_SCREENS = new Set<DailyLightVisualReviewScreen>([
  "foundation",
  "home",
  "auth",
  "interview-start",
  "interview-chat",
  "interview-complete",
  "day",
  "week",
  "month",
  "insights-trends",
  "insights-portrait",
  "insights-memories",
  "settings",
  "legal"
]);

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Light 全站视觉验收",
  description: "Daily Light 设计基础、核心流程和用户页面的零写入视觉验收稿。",
  robots: { index: false, follow: false }
};

type VisualReviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DailyLightVisualReviewPage({ searchParams }: VisualReviewPageProps) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") {
    notFound();
  }

  const resolved = searchParams ? await searchParams : {};
  const requestedScreen = typeof resolved.screen === "string" ? resolved.screen : null;
  const initialScreen: DailyLightVisualReviewScreen = requestedScreen
    && VISUAL_REVIEW_SCREENS.has(requestedScreen as DailyLightVisualReviewScreen)
    ? requestedScreen as DailyLightVisualReviewScreen
    : "interview-start";

  return <DailyLightVisualReview initialScreen={initialScreen} clean={resolved.clean === "1"} />;
}
