import clsx from "clsx";
import Image from "next/image";

import type { HomepageVisualConfig } from "@/content/homepage";

type HomepageVisualVariant = "hero" | "panel" | "wide";

interface HomepageVisualProps {
  visual: HomepageVisualConfig;
  variant?: HomepageVisualVariant;
  className?: string;
}

const imageClasses: Record<HomepageVisualVariant, string> = {
  hero: "min-h-[25rem] md:min-h-[37rem]",
  panel: "min-h-[19rem] md:min-h-[24rem]",
  wide: "min-h-[18rem] md:min-h-[22rem]"
};

export function HomepageVisual({ visual, variant = "panel", className }: HomepageVisualProps) {
  return (
    <figure className={clsx("relative", className)}>
      <p className="whitespace-nowrap font-display text-[clamp(1rem,2.4vw,1.16rem)] leading-none text-[#2d2014]">
        {visual.title}
      </p>

      <div
        className={clsx(
          "relative mt-3 overflow-hidden rounded-[2rem] shadow-[0_22px_52px_rgba(73,45,21,0.14)] ring-1 ring-[rgba(255,249,238,0.18)]",
          imageClasses[variant]
        )}
      >
        {visual.src ? (
          <Image
            src={visual.src}
            alt={visual.alt}
            fill
            sizes={variant === "hero" ? "(min-width: 1024px) 48vw, 100vw" : "(min-width: 1024px) 52vw, 100vw"}
            className="object-cover"
            loading={variant === "hero" ? "eager" : "lazy"}
            priority={variant === "hero"}
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-end bg-[linear-gradient(180deg,rgba(247,234,207,0.58),rgba(181,129,78,0.58))] p-5">
            <div className="max-w-[18rem] rounded-[1.2rem] bg-[rgba(255,248,238,0.34)] px-4 py-3 backdrop-blur-[1px]">
              <p className="font-display text-[1.05rem] leading-[1.1] text-[#2d2014]">{visual.title}</p>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
