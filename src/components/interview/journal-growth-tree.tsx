"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

interface JournalGrowthTreeProps {
  progress: number;
  compact?: boolean;
  className?: string;
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}

export function JournalGrowthTree({ progress, compact = false, className = "" }: JournalGrowthTreeProps) {
  const id = useId();
  const leafGradientId = `${id}-leaf`;
  const canopyGlowGradientId = `${id}-canopy-glow`;
  const trunkGradientId = `${id}-trunk`;
  const barkGradientId = `${id}-bark`;
  const paperGradientId = `${id}-paper`;
  const haloGradientId = `${id}-halo`;
  const normalizedProgress = clampProgress(progress);
  const growth = normalizedProgress / 100;
  const trunkHeight = 16 + growth * 40;
  const trunkTop = 88 - trunkHeight;
  const canopyScale = Math.max(0.24, Math.min(1, (normalizedProgress - 18) / 82));
  const leafOpacity = Math.min(1, Math.max(0.2, (normalizedProgress - 12) / 60));
  const branchOpacity = Math.min(0.94, Math.max(0, (normalizedProgress - 28) / 40));
  const seedOpacity = Math.max(0, 1 - normalizedProgress / 38);
  const rootOpacity = Math.min(0.88, Math.max(0.18, normalizedProgress / 72));
  const paperLift = Math.max(0, Math.min(1, (normalizedProgress - 8) / 44));
  const haloOpacity = Math.min(0.68, 0.22 + growth * 0.42);
  const moteOpacity = Math.min(0.76, Math.max(0.08, (normalizedProgress - 24) / 76));

  return (
    <div
      className={cn(
        "pointer-events-none relative mx-auto flex items-end justify-center",
        compact ? "h-16 w-24" : "h-28 w-40",
        className
      )}
      aria-hidden="true"
      data-testid="journal-growth-tree"
    >
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id={haloGradientId} cx="50%" cy="38%" r="60%">
            <stop offset="0%" stopColor="rgba(255,244,213,0.88)" />
            <stop offset="55%" stopColor="rgba(241,210,150,0.28)" />
            <stop offset="100%" stopColor="rgba(241,210,150,0)" />
          </radialGradient>
          <linearGradient id={paperGradientId} x1="0" x2="1" y1="0.2" y2="1">
            <stop offset="0%" stopColor="#fff6e7" />
            <stop offset="58%" stopColor="#efd9b8" />
            <stop offset="100%" stopColor="#d7b486" />
          </linearGradient>
          <radialGradient id={leafGradientId} cx="42%" cy="34%" r="66%">
            <stop offset="0%" stopColor="#efe3a4" />
            <stop offset="48%" stopColor="#94a765" />
            <stop offset="100%" stopColor="#617741" />
          </radialGradient>
          <radialGradient id={canopyGlowGradientId} cx="48%" cy="36%" r="62%">
            <stop offset="0%" stopColor="rgba(255,246,213,0.72)" />
            <stop offset="100%" stopColor="rgba(255,246,213,0)" />
          </radialGradient>
          <linearGradient id={trunkGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a67448" />
            <stop offset="100%" stopColor="#694121" />
          </linearGradient>
          <linearGradient id={barkGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,223,180,0.55)" />
            <stop offset="100%" stopColor="rgba(105,65,33,0)" />
          </linearGradient>
        </defs>

        <ellipse cx="60" cy="52" rx="34" ry="26" fill={`url(#${haloGradientId})`} opacity={haloOpacity} className="journal-growth-breathe" />

        <g
          className="transition-transform duration-700 ease-out"
          style={{ transform: `translateY(${(1 - paperLift) * 4}px)` }}
        >
          <path
            d="M20 94 C31 85 47 84 58 90 C69 97 83 97 100 88 L100 102 L20 102 Z"
            fill={`url(#${paperGradientId})`}
            opacity={0.92}
          />
          <path
            d="M16 99 C30 89 44 89 57 95 C70 102 86 102 104 91"
            stroke="rgba(151,111,73,0.38)"
            strokeWidth="1.8"
            fill="none"
          />
          <path
            d="M22 89 C33 80 45 80 58 85 C72 91 84 90 98 82"
            stroke="rgba(255,247,232,0.58)"
            strokeWidth="1.1"
            fill="none"
          />
        </g>

        <ellipse cx="60" cy="92" rx="30" ry="7.4" fill="rgba(116,81,45,0.13)" />
        <ellipse cx="60" cy="88" rx="18" ry="4.6" fill="rgba(124,94,57,0.18)" opacity={0.76} />
        <path
          d="M54 87 C50 91 48 94 46 98"
          stroke="rgba(123,86,47,0.3)"
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity={rootOpacity}
          className="transition-opacity duration-700 ease-out"
        />
        <path
          d="M66 87 C70 91 72 94 74 98"
          stroke="rgba(123,86,47,0.3)"
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity={rootOpacity}
          className="transition-opacity duration-700 ease-out"
        />
        <circle cx="60" cy="84" r="5" fill="#8f6b3f" opacity={seedOpacity} className="transition-opacity duration-700 ease-out" />
        <g className="origin-[60px_88px] journal-growth-bob">
          <rect
            x="54.5"
            y={trunkTop}
            width="11"
            height={trunkHeight}
            rx="5.5"
            fill={`url(#${trunkGradientId})`}
            className="transition-all duration-700 ease-out"
          />
          <rect
            x="56.5"
            y={trunkTop + 1.5}
            width="4"
            height={Math.max(12, trunkHeight - 4)}
            rx="2"
            fill={`url(#${barkGradientId})`}
            opacity={0.58}
            className="transition-all duration-700 ease-out"
          />
        </g>
        <g opacity={branchOpacity} className="origin-[60px_70px] transition-opacity duration-700 ease-out journal-growth-sway">
          <path d="M59 68 C48 64 42 58 37 49" stroke="#6b4322" strokeWidth="4.6" strokeLinecap="round" fill="none" />
          <path d="M61 63 C71 59 78 54 84 45" stroke="#6b4322" strokeWidth="4.8" strokeLinecap="round" fill="none" />
          <path d="M60 73 C52 71 46 67 41 60" stroke="#734928" strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <path d="M61 72 C69 69 74 65 78 59" stroke="#734928" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </g>
        <g transform={`translate(60 42) scale(${canopyScale})`} opacity={leafOpacity} className="transition-[opacity,transform] duration-700 ease-out">
          <g className="origin-center journal-growth-sway">
            <ellipse cx="0" cy="6" rx="39" ry="28" fill={`url(#${canopyGlowGradientId})`} opacity={0.66} />
            <circle cx="-22" cy="6" r="18" fill={`url(#${leafGradientId})`} />
            <circle cx="1" cy="-12" r="22" fill={`url(#${leafGradientId})`} />
            <circle cx="24" cy="4" r="18.5" fill={`url(#${leafGradientId})`} />
            <circle cx="-1" cy="15" r="22" fill={`url(#${leafGradientId})`} />
            <circle cx="-10" cy="-15" r="8.5" fill="rgba(255,239,186,0.5)" />
            <circle cx="13" cy="-4" r="6" fill="rgba(234,221,154,0.24)" />
          </g>
        </g>

        <g opacity={moteOpacity} className="transition-opacity duration-700 ease-out">
          <circle cx="34" cy="36" r="1.8" fill="rgba(255,244,217,0.88)" className="journal-growth-float-slow" />
          <circle cx="92" cy="42" r="1.6" fill="rgba(246,229,183,0.78)" className="journal-growth-float" />
          <circle cx="86" cy="30" r="1.2" fill="rgba(255,245,221,0.72)" className="journal-growth-float-slow" />
          <circle cx="25" cy="58" r="1.4" fill="rgba(238,221,176,0.7)" className="journal-growth-float" />
        </g>
      </svg>
    </div>
  );
}
