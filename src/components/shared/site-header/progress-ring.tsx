export function ProgressRing({
  percentage,
  label,
  testId,
  size = 22
}: {
  percentage: number;
  label: string;
  testId?: string;
  size?: number;
}) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percentage / 100);

  return (
    <div
      data-testid={testId}
      aria-label={label}
      title={label}
      className="relative inline-flex items-center justify-center"
      style={{ height: size, width: size }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(143,103,68,0.18)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(168,112,60,0.92)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span aria-hidden="true" className="absolute h-1.5 w-1.5 rounded-full bg-[rgba(168,112,60,0.9)]" />
    </div>
  );
}
