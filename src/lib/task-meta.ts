// DB-free metadata for journal tasks. Lives in lib/ so client components can
// import without dragging the DB client (and its native bindings) into the
// browser bundle.

// Order matters — drives the on-page card order inside TasksBlock.
// Non-negotiables come first so they read as the foundation of the day.
export const TASK_KINDS = ["nonNegotiable", "goal", "secondary"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  goal: "Goals",
  nonNegotiable: "Non-Negotiables",
  secondary: "Todos",
};

export const TASK_KIND_HINTS: Record<TaskKind, string> = {
  goal: "what you want to move forward today",
  nonNegotiable: "must-do, no excuses",
  secondary: "nice-to-have if time allows",
};

// Sentinel marker used inside trace stub rows left behind when a task is
// moved. The row's text is stored as
//   "{originalText} → Moved to {Month DD}"
// Detection is a substring check on the marker — no schema column needed.
// The marker is unique enough that user-typed text won't accidentally
// match (the leading space + arrow + "Moved to " combination).
export const TASK_TRACE_MARKER = " → Moved to ";

export function isTraceTask(text: string): boolean {
  return text.includes(TASK_TRACE_MARKER);
}
