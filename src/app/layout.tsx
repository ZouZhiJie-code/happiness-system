import type { Metadata } from "next";

import { SiteHeader } from "@/components/shared/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "幸福系统",
  description: "用结构化访谈整理每日开心、充实、思考、改进与感谢的记录界面。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-body text-ink antialiased">
        <div className="relative min-h-screen overflow-hidden px-1.5 py-3 md:px-2.5 md:py-4 xl:px-3">
          <SiteHeader />
          <main className="mx-auto max-w-[88rem] pb-4 pt-4 md:pb-5 md:pt-5">{children}</main>
        </div>
      </body>
    </html>
  );
}
