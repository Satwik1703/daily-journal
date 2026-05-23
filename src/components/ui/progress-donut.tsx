/**
 * Pure SVG donut for percentages (0..100). Used by goals summary card +
 * habits progress card. Tracks `var(--muted)`, progress arc `var(--primary)`.
 */
export function ProgressDonut({
  percent,
  size = 80,
  strokeWidth = 8,
  label,
  className,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** Optional center label override; defaults to `${rounded}%`. */
  label?: React.ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const rounded = Math.round(clamped);
  const ringPath = describeRing(clamped);

  return (
    <div
      className={"relative flex shrink-0 items-center justify-center " + (className ?? "")}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 72 72" className="-rotate-90" style={{ width: size, height: size }}>
        <circle
          cx="36"
          cy="36"
          r="30"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <path
          d={ringPath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-semibold tabular-nums">
          {label ?? `${rounded}%`}
        </span>
      </div>
    </div>
  );
}

/** SVG arc path describing N% of a circle (radius 30, center 36,36), starting at top. */
function describeRing(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  if (clamped === 0) return "M 36 6";
  if (clamped >= 100) {
    return "M 36 6 A 30 30 0 1 1 36 66 A 30 30 0 1 1 36 6";
  }
  const angle = (clamped / 100) * 2 * Math.PI;
  const cx = 36;
  const cy = 36;
  const r = 30;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  const largeArc = clamped > 50 ? 1 : 0;
  return `M 36 6 A ${r} ${r} 0 ${largeArc} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}
