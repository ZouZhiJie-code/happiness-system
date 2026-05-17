import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthLocalBootstrap } from "@/components/auth/auth-local-bootstrap";
import { SiteHeader } from "@/components/shared/site-header";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { getCurrentUserFromSessionToken } from "@/server/services/auth/current-user.service";

import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Light | 在日常里照见自己",
  description: "用 AI 访谈和幸福日志整理每日开心、充实、思考、改进与感谢，帮助你更理解自己的喜悦、牵挂与抉择。",
  icons: {
    icon: [{ url: "/brand/happiness-logo.png", type: "image/png" }],
    apple: [{ url: "/brand/happiness-logo.png", sizes: "1254x1254", type: "image/png" }]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-body text-ink antialiased">
        <div className="relative flex min-h-dvh flex-col">
          <AuthLocalBootstrap userId={currentUser?.id ?? null} />
          <Suspense fallback={<div className="h-[var(--site-header-frame-min-height)] w-full" />}>
            <SiteHeader />
          </Suspense>
          <main className="flex min-h-0 w-full flex-1 flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
