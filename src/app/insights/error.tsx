"use client";

import { ActionButton, Surface } from "@/components/ui";

export default function InsightsError({ reset }: { reset: () => void }) {
  return (
    <Surface
      as="section"
      className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-10 md:px-8 xl:px-10"
    >
      <div className="mx-auto flex min-h-[28rem] w-full max-w-[74rem] items-center">
        <div className="max-w-lg">
          <h1 className="text-balance font-ui text-[28px] font-semibold leading-tight text-[var(--text-main)] md:text-[32px]">
            这次没能打开认识自己
          </h1>
          <p className="mt-3 text-pretty text-[15px] leading-7 text-[var(--text-dim)]">
            你的记录还在。可以再试一次。
          </p>
          <ActionButton type="button" variant="primary" className="mt-6" onClick={reset}>
            重新打开
          </ActionButton>
        </div>
      </div>
    </Surface>
  );
}
