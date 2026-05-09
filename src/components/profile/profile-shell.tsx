"use client";

import { useState } from "react";

import type { ProfileViewTab } from "@/features/portrait/types";
import { PortraitView } from "@/components/profile/portrait-view";
import { MemoriesView } from "@/components/profile/memories-view";
import { EvolutionContainer } from "@/components/profile/evolution-container";

const TABS: { key: ProfileViewTab; label: string }[] = [
  { key: "portrait", label: "画像" },
  { key: "memories", label: "记忆库" },
  { key: "evolution", label: "演变" }
];

export function ProfileShell() {
  const [tab, setTab] = useState<ProfileViewTab>("portrait");

  return (
    <div className="grid min-h-0 gap-4">
      <nav className="flex items-center gap-0 border-b border-[rgba(115,77,39,0.12)]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`relative px-4 py-2.5 font-mono text-[0.72rem] tracking-[0.18em] transition-colors ${
              tab === t.key
                ? "text-[#2c2117]"
                : "text-[#8a7a68] hover:text-[#5a4632]"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-4 -bottom-px h-px bg-[#2c2117]" />
            )}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === "portrait" && <PortraitView />}
        {tab === "memories" && <MemoriesView />}
        {tab === "evolution" && <EvolutionContainer />}
      </div>
    </div>
  );
}
