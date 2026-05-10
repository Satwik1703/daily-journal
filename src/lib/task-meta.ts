// DB-free metadata for journal tasks. Lives in lib/ so client components can
// import without dragging the DB client (and its native bindings) into the
// browser bundle.

export const TASK_KINDS = ["goal", "nonNegotiable", "secondary"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  goal: "Goals",
  nonNegotiable: "Non-negotiables",
  secondary: "Secondary",
};

export const TASK_KIND_HINTS: Record<TaskKind, string> = {
  goal: "what you want to move forward today",
  nonNegotiable: "must-do, no excuses",
  secondary: "nice-to-have if time allows",
};
