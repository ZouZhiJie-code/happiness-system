import { Surface } from "@/components/ui";

export function InsightsWorkspaceSkeleton() {
  return (
    <Surface
      as="section"
      aria-label="正在打开认识自己"
      aria-busy="true"
      className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
    >
      <div className="mx-auto w-full max-w-[74rem] animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-40 rounded-[var(--radius-control)] bg-[var(--paper-soft)]" />
        <div className="mt-3 h-5 w-72 max-w-full rounded-[var(--radius-control)] bg-[var(--paper-soft)]" />
        <div className="mt-8 h-11 border-b border-[var(--line-soft)]" />
        <div className="mt-8 h-7 w-32 rounded-[var(--radius-control)] bg-[var(--paper-soft)]" />
        <div className="mt-6 grid grid-cols-2 gap-px border-y border-[var(--line-soft)] bg-[var(--line-soft)] md:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-24 bg-[var(--paper-main)] p-4">
              <div className="h-4 w-20 rounded bg-[var(--paper-soft)]" />
              <div className="mt-3 h-7 w-12 rounded bg-[var(--paper-soft)]" />
            </div>
          ))}
        </div>
        <div className="mt-10 h-7 w-44 rounded-[var(--radius-control)] bg-[var(--paper-soft)]" />
        <div className="mt-5 grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }, (_, index) => (
            <div key={index} className="h-16 rounded-[var(--radius-control)] bg-[var(--paper-soft)]" />
          ))}
        </div>
      </div>
    </Surface>
  );
}
