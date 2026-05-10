"use client";

import { MUSCLE_LABELS, type MuscleGroup } from "@/lib/muscle-groups";

export type BodyView = "front" | "back";

export type BodyProps = {
  view: BodyView;
  /** Returns the fill color for a muscle group (e.g. white→red lerp). */
  fillFor: (muscle: MuscleGroup) => string;
  onMuscleClick?: (muscle: MuscleGroup) => void;
  className?: string;
};

export function BodySvg({ view, fillFor, onMuscleClick, className }: BodyProps) {
  const muscleGroupProps = (m: MuscleGroup) => ({
    id: m,
    fill: fillFor(m),
    role: onMuscleClick ? "button" : "img",
    "aria-label": MUSCLE_LABELS[m],
    tabIndex: onMuscleClick ? 0 : undefined,
    style: onMuscleClick ? { cursor: "pointer" as const } : undefined,
    onClick: onMuscleClick ? () => onMuscleClick(m) : undefined,
    onKeyDown: onMuscleClick
      ? (e: React.KeyboardEvent<SVGGElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onMuscleClick(m);
          }
        }
      : undefined,
  });

  return (
    <svg
      viewBox="0 0 200 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ touchAction: "manipulation" }}
    >
      {/* Body silhouette (constant neutral) */}
      <g
        fill="var(--muted)"
        stroke="color-mix(in oklch, var(--border), transparent 30%)"
        strokeWidth="1"
        strokeLinejoin="round"
      >
        {/* head */}
        <ellipse cx="100" cy="42" rx="22" ry="26" />
        {/* neck */}
        <rect x="92" y="64" width="16" height="20" rx="2" />
        {/* torso */}
        <path d="M 72 88 Q 60 92 56 102 L 56 200 Q 56 218 78 232 L 78 260 L 122 260 L 122 232 Q 144 218 144 200 L 144 102 Q 140 92 128 88 Z" />
        {/* upper arms */}
        <rect x="40" y="92" width="20" height="92" rx="9" />
        <rect x="140" y="92" width="20" height="92" rx="9" />
        {/* lower arms */}
        <rect x="42" y="184" width="18" height="80" rx="8" />
        <rect x="140" y="184" width="18" height="80" rx="8" />
        {/* hands */}
        <ellipse cx="51" cy="270" rx="8" ry="6" />
        <ellipse cx="149" cy="270" rx="8" ry="6" />
        {/* upper legs */}
        <rect x="74" y="262" width="22" height="110" rx="10" />
        <rect x="104" y="262" width="22" height="110" rx="10" />
        {/* lower legs */}
        <rect x="76" y="372" width="20" height="100" rx="9" />
        <rect x="104" y="372" width="20" height="100" rx="9" />
        {/* feet */}
        <ellipse cx="86" cy="478" rx="10" ry="6" />
        <ellipse cx="114" cy="478" rx="10" ry="6" />
      </g>

      {/* Muscles */}
      {view === "front" ? <FrontMuscles muscleProps={muscleGroupProps} /> : <BackMuscles muscleProps={muscleGroupProps} />}
    </svg>
  );
}

function FrontMuscles({
  muscleProps,
}: {
  muscleProps: (m: MuscleGroup) => React.SVGProps<SVGGElement>;
}) {
  return (
    <g stroke="color-mix(in oklch, #000, transparent 85%)" strokeWidth="0.6">
      <g {...muscleProps("front_delts")}>
        <circle cx="76" cy="96" r="9" />
        <circle cx="124" cy="96" r="9" />
      </g>
      <g {...muscleProps("side_delts")}>
        <ellipse cx="62" cy="104" rx="6" ry="10" />
        <ellipse cx="138" cy="104" rx="6" ry="10" />
      </g>
      <g {...muscleProps("chest")}>
        <ellipse cx="86" cy="118" rx="14" ry="11" />
        <ellipse cx="114" cy="118" rx="14" ry="11" />
      </g>
      <g {...muscleProps("biceps")}>
        <rect x="42" y="106" width="16" height="68" rx="7" />
        <rect x="142" y="106" width="16" height="68" rx="7" />
      </g>
      <g {...muscleProps("forearms")}>
        <rect x="44" y="186" width="14" height="72" rx="6" />
        <rect x="142" y="186" width="14" height="72" rx="6" />
      </g>
      <g {...muscleProps("abs")}>
        <rect x="91" y="135" width="18" height="78" rx="6" />
      </g>
      <g {...muscleProps("obliques")}>
        <rect x="73" y="148" width="9" height="56" rx="4" />
        <rect x="118" y="148" width="9" height="56" rx="4" />
      </g>
      <g {...muscleProps("quads")}>
        <rect x="76" y="270" width="20" height="92" rx="9" />
        <rect x="104" y="270" width="20" height="92" rx="9" />
      </g>
      <g {...muscleProps("calves")}>
        <rect x="78" y="380" width="18" height="78" rx="8" />
        <rect x="104" y="380" width="18" height="78" rx="8" />
      </g>
    </g>
  );
}

function BackMuscles({
  muscleProps,
}: {
  muscleProps: (m: MuscleGroup) => React.SVGProps<SVGGElement>;
}) {
  return (
    <g stroke="color-mix(in oklch, #000, transparent 85%)" strokeWidth="0.6">
      <g {...muscleProps("traps")}>
        <path d="M 88 90 L 100 102 L 112 90 L 108 110 L 92 110 Z" />
      </g>
      <g {...muscleProps("rear_delts")}>
        <circle cx="76" cy="98" r="8" />
        <circle cx="124" cy="98" r="8" />
      </g>
      <g {...muscleProps("upper_back")}>
        <rect x="78" y="112" width="44" height="22" rx="6" />
      </g>
      <g {...muscleProps("lats")}>
        {/* Two angled trapezoids forming a V */}
        <path d="M 78 134 L 122 134 L 116 184 L 84 184 Z" />
      </g>
      <g {...muscleProps("triceps")}>
        <rect x="42" y="108" width="16" height="68" rx="7" />
        <rect x="142" y="108" width="16" height="68" rx="7" />
      </g>
      <g {...muscleProps("forearms")}>
        <rect x="44" y="186" width="14" height="72" rx="6" />
        <rect x="142" y="186" width="14" height="72" rx="6" />
      </g>
      <g {...muscleProps("lower_back")}>
        <rect x="86" y="186" width="28" height="22" rx="5" />
      </g>
      <g {...muscleProps("glutes")}>
        <ellipse cx="88" cy="232" rx="14" ry="14" />
        <ellipse cx="112" cy="232" rx="14" ry="14" />
      </g>
      <g {...muscleProps("hamstrings")}>
        <rect x="76" y="270" width="20" height="92" rx="9" />
        <rect x="104" y="270" width="20" height="92" rx="9" />
      </g>
      <g {...muscleProps("calves")}>
        <rect x="78" y="380" width="18" height="78" rx="8" />
        <rect x="104" y="380" width="18" height="78" rx="8" />
      </g>
    </g>
  );
}
