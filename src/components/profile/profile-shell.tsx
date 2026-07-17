"use client";

import { useState } from "react";

import { HorizontalPager, SlidingSegmentedControl } from "@/components/ui";
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
      <SlidingSegmentedControl
        variant="underline"
        ariaLabel="画像页视图"
        value={tab}
        onChange={setTab}
        items={TABS.map((item) => ({
          value: item.key,
          label: item.label,
          buttonProps: {
            role: "tab",
            "aria-selected": tab === item.key
          }
        }))}
      />

      <div role="tabpanel" className="min-h-[12rem]">
        <HorizontalPager
          activeKey={tab}
          ariaLabel="画像页内容"
          pages={TABS.map((item) => ({
            key: item.key,
            children:
              item.key === "portrait" ? (
                <PortraitView onOpenMemories={() => setTab("memories")} />
              ) : item.key === "memories" ? (
                <MemoriesView />
              ) : (
                <EvolutionContainer />
              )
          }))}
        />
      </div>
    </div>
  );
}
