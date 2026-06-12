export type AppToastPlacement = "center" | "upper-center";

const PLACEMENT_CLASS: Record<AppToastPlacement, string> = {
  center: "items-center justify-center",
  "upper-center": "items-start justify-center pt-[32vh]"
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
      className={`pointer-events-none fixed inset-0 z-50 flex px-4 ${PLACEMENT_CLASS[placement]}`}
    >
      <div
        data-testid={testId}
        className="max-w-[min(100%,22rem)] rounded-[20px] border border-[rgba(119,79,40,0.18)] bg-[rgba(46,35,25,0.92)] px-5 py-2.5 text-center text-sm leading-snug text-[rgba(255,245,230,0.96)] shadow-[0_18px_42px_rgba(46,35,25,0.28)]"
      >
        {message}
      </div>
    </div>
  );
}
