import React from "react";

export default function InterviewLoading() {
  return (
    <div
      className="page-shell flex min-h-[32rem] flex-col gap-4 rounded-none border-x-0 border-t-0 p-3 md:p-4"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">正在打开访谈</span>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(150,109,66,0.16)]" />
        <div className="flex flex-1 flex-col justify-end gap-3 pb-2">
          <div className="h-16 w-[78%] animate-pulse self-start rounded-[28px] bg-[rgba(255,248,238,0.6)]" />
          <div className="h-12 w-[58%] animate-pulse self-end rounded-[28px] bg-[rgba(221,185,133,0.45)]" />
          <div className="h-20 w-[82%] animate-pulse self-start rounded-[28px] bg-[rgba(255,246,234,0.7)]" />
        </div>
      </div>
      <div className="h-12 w-full animate-pulse rounded-[26px] bg-[rgba(255,250,242,0.7)] shadow-[0_12px_24px_rgba(120,92,63,0.08)]" />
    </div>
  );
}
