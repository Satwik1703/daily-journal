import type { JournalStatus } from "./journal-status";

export type LegendRow = {
  status: JournalStatus;
  label: string;
  meaning: string;
};

export type CalendarLegend = {
  title: string;
  blurb: string;
  rows: LegendRow[];
};

export const JOURNAL_LEGEND: CalendarLegend = {
  title: "Journal calendar",
  blurb:
    "Cells color by how many tasks you completed that day. Non-negotiables weigh extra.",
  rows: [
    { status: "crazy", label: "Crazy", meaning: "All non-negotiables done + 3+ other tasks" },
    { status: "great", label: "Great", meaning: "All non-negotiables done" },
    { status: "good",  label: "Good",  meaning: "3+ tasks done" },
    { status: "avg",   label: "Avg",   meaning: "1–2 tasks done" },
    { status: "bad",   label: "Bad",   meaning: "Entry exists, 0 tasks done" },
  ],
};

export const HABITS_LEGEND: CalendarLegend = {
  title: "Habits calendar",
  blurb:
    "Cells color by how many habits you completed that day. Habits hidden by weekday-mask don't count.",
  rows: [
    { status: "crazy", label: "Crazy", meaning: "5+ habits done" },
    { status: "great", label: "Great", meaning: "4 habits done" },
    { status: "good",  label: "Good",  meaning: "3 habits done" },
    { status: "avg",   label: "Avg",   meaning: "1–2 habits done" },
    { status: "bad",   label: "Bad",   meaning: "Habits were active, 0 done" },
  ],
};

export const POMODORO_LEGEND: CalendarLegend = {
  title: "Pomodoro calendar",
  blurb: "Cells color by pomodoro count. 1 pomo = 50 minutes of focused work.",
  rows: [
    { status: "crazy", label: "Crazy", meaning: "6+ pomos" },
    { status: "great", label: "Great", meaning: "5 pomos" },
    { status: "good",  label: "Good",  meaning: "3–4 pomos" },
    { status: "avg",   label: "Avg",   meaning: "1–2 pomos (incl. partials)" },
    { status: "bad",   label: "Bad",   meaning: "0 pomos" },
  ],
};

export const FOOD_LEGEND: CalendarLegend = {
  title: "Food calendar",
  blurb: "Cells color by how close your day's kcal came to the target from your nutrition profile.",
  rows: [
    { status: "crazy", label: "Crazy", meaning: "Within ±10% of daily target" },
    { status: "great", label: "Great", meaning: "Within ±20% of target" },
    { status: "good", label: "Good", meaning: "Within ±35% of target (or logged w/o target)" },
    { status: "avg", label: "Avg", meaning: "Way off target" },
    { status: "bad", label: "Bad", meaning: "Had a target, no logs" },
  ],
};

export const GYM_LEGEND: CalendarLegend = {
  title: "Gym calendar",
  blurb:
    "Cells color by daily volume (reps × kg) vs. your 90-day max. Lazy days (sets logged, no weight) bucket by set count.",
  rows: [
    { status: "crazy", label: "Crazy", meaning: "≥90% of 90-day max volume" },
    { status: "great", label: "Great", meaning: "70–90% of 90-day max" },
    { status: "good",  label: "Good",  meaning: "45–70% of 90-day max" },
    { status: "avg",   label: "Avg",   meaning: "20–45% of 90-day max" },
    { status: "bad",   label: "Bad",   meaning: "<20% of max, or 1–3 lazy sets" },
  ],
};
