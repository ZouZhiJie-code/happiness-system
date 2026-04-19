"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/interview", label: "访谈" },
  { href: "/settings", label: "设置" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="page-shell mx-auto max-w-[88rem] rounded-[28px] px-4 py-3.5 backdrop-blur md:px-5 md:py-3.5">
      <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(166,121,74,0.18)] bg-[rgba(255,250,242,0.55)] text-[0.62rem] font-mono uppercase tracking-[0.24em] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            HS
          </div>
          <p className="font-display text-lg tracking-[0.1em] text-[#2f2823]">幸福系统</p>
        </Link>
        <nav className="flex items-center gap-1.5 rounded-full border border-[rgba(136,92,50,0.22)] bg-[rgba(244,226,194,0.72)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-300",
                isActive(item.href)
                  ? "bg-[linear-gradient(180deg,rgba(191,138,81,0.95),rgba(160,106,54,0.96))] text-[#fff8f1] shadow-[0_8px_18px_rgba(118,75,37,0.2)]"
                  : "text-[#4a4038] hover:bg-[rgba(169,111,61,0.14)] hover:text-[#2f2823]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
