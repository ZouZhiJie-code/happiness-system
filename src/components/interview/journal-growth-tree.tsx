"use client";

import React, { useId } from "react";

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
  const trunkGradientId = `${id}-trunk`;
  const normalizedProgress = clampProgress(progress);
  const growth = normalizedProgress / 100;
  const trunkHeight = 12 + growth * 43;
  const trunkTop = 88 - trunkHeight;
  const canopyScale = Math.max(0.18, Math.min(1, (normalizedProgress - 22) / 78));
  const leafOpacity = Math.min(1, Math.max(0.22, (normalizedProgress - 14) / 64));
  const branchOpacity = Math.min(0.9, Math.max(0, (normalizedProgress - 34) / 46));
  const seedOpacity = Math.max(0, 1 - normalizedProgress / 42);

  return (
    <div
      className={`pointer-events-none relative mx-auto flex ${compact ? "h-16 w-24" : "h-28 w-40"} items-end justify-center ${className}`}
      aria-hidden="true"
      data-testid="journal-growth-tree"
    >
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id={leafGradientId} cx="42%" cy="34%" r="66%">
            <stop offset="0%" stopColor="#d7c37b" />
            <stop offset="54%" stopColor="#8f9e58" />
            <stop offset="100%" stopColor="#5f743b" />
          </radialGradient>
          <linearGradient id={trunkGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9d7041" />
            <stop offset="100%" stopColor="#654021" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="92" rx="34" ry="7" fill="rgba(127,92,55,0.14)" />
        <ellipse cx="60" cy="88" rx="20" ry="5" fill="rgba(133,105,63,0.18)" opacity={0.74} />
        <circle cx="60" cy="84" r="5" fill="#8f6b3f" opacity={seedOpacity} />
        <rect
          x="55"
          y={trunkTop}
          width="10"
          height={trunkHeight}
          rx="5"
          fill={`url(#${trunkGradientId})`}
          className="transition-all duration-700 ease-out"
        />
        <g opacity={branchOpacity} className="transition-opacity duration-700 ease-out">
          <path d="M60 66 C49 61 43 56 38 48" stroke="#704820" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M61 62 C73 58 79 52 85 43" stroke="#704820" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M59 73 C51 70 46 66 41 60" stroke="#704820" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
        <g
          transform={`translate(60 42) scale(${canopyScale})`}
          opacity={leafOpacity}
          className="transition-[opacity,transform] duration-700 ease-out"
        >
          <circle cx="-22" cy="6" r="19" fill={`url(#${leafGradientId})`} />
          <circle cx="0" cy="-12" r="24" fill={`url(#${leafGradientId})`} />
          <circle cx="24" cy="5" r="20" fill={`url(#${leafGradientId})`} />
          <circle cx="-2" cy="15" r="25" fill={`url(#${leafGradientId})`} />
          <circle cx="-12" cy="-15" r="10" fill="rgba(238,220,143,0.56)" />
        </g>
      </svg>
    </div>
  );
}
