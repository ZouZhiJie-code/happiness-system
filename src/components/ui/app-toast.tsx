export type AppToastPlacement = "center" | "upper-center" | "below-header";

const PLACEMENT_CLASS: Record<AppToastPlacement, string> = {
  center: "items-center justify-center",
  "upper-center": "items-start justify-center pt-[32vh]",
  "below-header": "items-start justify-center pt-[calc(var(--site-header-viewport-offset)+0.75rem)]"
};

export function AppToast({
  message,
  testId = "app-toast",
  placement = "center"
}: {
  message: string;
  testId?: string;
  placement?: AppToastPlacement;
}) {
  return (
    <div
      aria-live="polite"
      className={`ui-app-toast pointer-events-none fixed inset-0 flex px-4 ${PLACEMENT_CLASS[placement]}`}
    >
      <div
        data-testid={testId}
        className="max-w-[min(100%,28rem)] rounded-[var(--radius-control)] border border-[var(--toast-border)] bg-[var(--toast-surface)] px-5 py-2.5 text-center text-sm leading-snug text-[var(--toast-text)] shadow-[var(--toast-shadow)]"
      >
        {message}
      </div>
    </div>
  );
}
