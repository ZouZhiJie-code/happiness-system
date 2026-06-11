import React from "react";

export default function SettingsLoading() {
  return (
    <div className="min-h-0 flex-1" aria-busy="true">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10" />
    </div>
  );
}
