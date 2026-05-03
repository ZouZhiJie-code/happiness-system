import clsx from "clsx";

import type { HomepageVisualConfig } from "@/content/homepage";

type HomepageVisualVariant = "hero" | "panel" | "wide";

interface HomepageVisualProps {
  visual: HomepageVisualConfig;
  variant?: HomepageVisualVariant;
  className?: string;
}

const variantClasses: Record<HomepageVisualVariant, string> = {
  hero: "min-h-[27rem] md:min-h-[34rem]",
  panel: "min-h-[22rem]",
  wide: "min-h-[20rem]"
};

const accentMap: Record<HomepageVisualVariant, string> = {
  hero: "rgba(169, 111, 61, 0.18)",
  panel: "rgba(132, 94, 54, 0.16)",
  wide: "rgba(118, 82, 48, 0.14)"
};

export function HomepageVisual({ visual, variant = "panel", className }: HomepageVisualProps) {
  return (
    <figure
      className={clsx(
        "group relative overflow-hidden rounded-[2rem] border border-[rgba(111,74,38,0.14)] bg-[linear-gradient(180deg,rgba(251,244,230,0.94),rgba(235,216,181,0.92))] shadow-[0_24px_60px_rgba(97,63,31,0.12)] transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-1",
        variantClasses[variant],
        className
      )}
      role="img"
      aria-label={visual.alt}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 18% 16%, rgba(255, 250, 242, 0.8) 0, transparent 28%), radial-gradient(circle at 82% 14%, rgba(171, 114, 61, 0.16) 0, transparent 24%), linear-gradient(135deg, rgba(255, 251, 244, 0.22), transparent 42%, rgba(146, 102, 58, 0.06) 70%, transparent 100%)"
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(91, 59, 29, 0.08) 0 1px, transparent 1px 18px), repeating-linear-gradient(180deg, transparent 0 17px, rgba(91, 59, 29, 0.04) 17px 18px)"
        }}
      />

      <div className="relative flex h-full flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-[#8b6a48]">{visual.label}</p>
            <p className="mt-3 max-w-[14ch] text-balance font-display text-[1.55rem] leading-[1.02] text-[#2d2014] md:text-[1.8rem]">
              {visual.title}
            </p>
          </div>
          <span className="rounded-full border border-[rgba(119,83,46,0.16)] bg-[rgba(255,249,240,0.74)] px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[#7e6042]">
            {visual.caption}
          </span>
        </div>

        <div className="relative mt-5 flex-1 overflow-hidden rounded-[1.6rem] border border-[rgba(110,73,38,0.12)] bg-[linear-gradient(180deg,rgba(255,251,244,0.82),rgba(245,228,198,0.76))]">
          {visual.src ? (
            <img
              src={visual.src}
              alt={visual.alt}
              className="h-full w-full object-cover"
              loading={variant === "hero" ? "eager" : "lazy"}
              decoding="async"
            />
          ) : (
            <div className="relative flex h-full min-h-[16rem] flex-col justify-between p-4 md:p-5">
              <div
                aria-hidden="true"
                className="absolute left-6 top-6 h-28 w-28 rounded-full blur-2xl"
                style={{ background: accentMap[variant] }}
              />
              <div
                aria-hidden="true"
                className="absolute right-4 top-8 h-24 w-24 rounded-full bg-[rgba(255,246,232,0.66)] blur-xl"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-4 bottom-4 h-[44%] rounded-[1.2rem] border border-[rgba(111,74,38,0.12)] bg-[rgba(255,250,244,0.72)] shadow-[0_18px_40px_rgba(82,52,23,0.08)]"
              />
              <div className="relative z-10 flex flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="max-w-[16rem]">
                    <p className="font-display text-[1.2rem] leading-[1.1] text-[#2d2014] md:text-[1.35rem]">{visual.alt}</p>
                    <p className="mt-3 text-[0.88rem] leading-6 text-[#5f4b3a]">{visual.caption}</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(119,83,46,0.14)] bg-[rgba(255,249,240,0.82)] font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[#7b5b3a]">
                    01
                  </div>
                </div>
                <div className="relative z-10 mt-8 space-y-3">
                  <div className="h-2 w-3/5 rounded-full bg-[rgba(97,63,31,0.16)]" />
                  <div className="h-2 w-4/5 rounded-full bg-[rgba(97,63,31,0.12)]" />
                  <div className="h-2 w-2/5 rounded-full bg-[rgba(97,63,31,0.1)]" />
                  <div className="mt-4 rounded-[1rem] border border-[rgba(111,74,38,0.12)] bg-[rgba(255,251,246,0.84)] px-4 py-3 shadow-[0_10px_24px_rgba(82,52,23,0.08)]">
                    <p className="font-display text-[1rem] leading-[1.15] text-[#2d2014] md:text-[1.05rem]">{visual.title}</p>
                    <p className="mt-1.5 text-[0.82rem] leading-6 text-[#685241]">{visual.caption}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <figcaption className="mt-4 text-[0.84rem] leading-6 text-[#6d573f]">{visual.alt}</figcaption>
      </div>
    </figure>
  );
}
