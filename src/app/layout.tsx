import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthLocalBootstrap } from "@/components/auth/auth-local-bootstrap";
import { AnalysisChromeProvider } from "@/components/analysis/analysis-chrome-context";
import { CalendarChromeProvider } from "@/components/calendar/calendar-chrome-context";
import { EventCenteredInterviewChromeProvider } from "@/components/interview/event-centered/event-centered-interview-chrome-context";
import { CalendarMainGate } from "@/components/calendar/calendar-main-gate";
import { PublicSecurityFooter } from "@/components/shared/public-security-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { getCurrentUserFromSessionToken } from "@/server/services/auth/current-user.service";
import { isAdminUsername } from "@/server/services/auth/admin-access";

import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Light | 从一句话开始，留下一份日记",
  description: "说下一件想留下的事，Daily Light 会帮你记进当天，并整理成可以回看的日记。",
  icons: {
    icon: [{ url: "/brand/happiness-logo.png", type: "image/png" }],
    apple: [{ url: "/brand/happiness-logo.png", sizes: "1254x1254", type: "image/png" }]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);
  const isAdmin = Boolean(currentUser?.username && isAdminUsername(currentUser.username));

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-ui text-ink antialiased">
        <Suspense fallback={null}>
          <AnalysisChromeProvider>
            <CalendarChromeProvider>
              <EventCenteredInterviewChromeProvider>
                <div className="relative flex min-h-dvh flex-col">
                  <AuthLocalBootstrap userId={currentUser?.id ?? null} />
                  <Suspense fallback={<div className="h-[var(--site-header-frame-min-height)] w-full" />}>
                    <SiteHeader
                      isAdmin={isAdmin}
                      authenticated={Boolean(currentUser)}
                      userId={currentUser?.id ?? null}
                    />
                  </Suspense>
                  <main className="flex min-h-0 w-full flex-1 flex-col">
                    <CalendarMainGate>{children}</CalendarMainGate>
                  </main>
                  <PublicSecurityFooter />
                </div>
              </EventCenteredInterviewChromeProvider>
            </CalendarChromeProvider>
          </AnalysisChromeProvider>
        </Suspense>
      </body>
    </html>
  );
}
