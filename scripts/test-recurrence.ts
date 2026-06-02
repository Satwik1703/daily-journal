import { parseRule, nextOccurrence, advanceOrEnd, describeRule } from "@/lib/todo/recurrence";

let pass = 0, fail = 0;
function eq(label: string, got: unknown, exp: unknown) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}: expected ${e}, got ${g}`); }
}

// daily
eq("daily +1", nextOccurrence({ freq: "daily", interval: 1, mode: "dueDate" }, "2026-06-02"), "2026-06-03");
eq("every 3 days", nextOccurrence({ freq: "daily", interval: 3, mode: "dueDate" }, "2026-06-02"), "2026-06-05");
// weekly plain
eq("weekly +7", nextOccurrence({ freq: "weekly", interval: 1, mode: "dueDate" }, "2026-06-02"), "2026-06-09");
// weekly byDay (2026-06-02 is Tue=2). byDay Mon(1),Thu(4) -> next is Thu 06-04
eq("weekly byDay", nextOccurrence({ freq: "weekly", interval: 1, byDay: [1, 4], mode: "dueDate" }, "2026-06-02"), "2026-06-04");
// monthly clamp (Jan 31 -> Feb 28 2027)
eq("monthly clamp", nextOccurrence({ freq: "monthly", interval: 1, mode: "dueDate" }, "2027-01-31"), "2027-02-28");
// yearly
eq("yearly", nextOccurrence({ freq: "yearly", interval: 1, mode: "dueDate" }, "2026-06-02"), "2027-06-02");
// ends after
eq("ends after reached", advanceOrEnd({ freq: "daily", interval: 1, mode: "dueDate", ends: { type: "after", count: 3 } }, "2026-06-02", 3), null);
eq("ends after not reached", advanceOrEnd({ freq: "daily", interval: 1, mode: "dueDate", ends: { type: "after", count: 3 } }, "2026-06-02", 2), "2026-06-03");
// ends on
eq("ends on passed", advanceOrEnd({ freq: "daily", interval: 1, mode: "dueDate", ends: { type: "on", date: "2026-06-02" } }, "2026-06-02", 1), null);
// parse validation
eq("parse bad", parseRule("{nope"), null);
eq("parse good freq", parseRule(JSON.stringify({ freq: "weekly", interval: 2, mode: "dueDate" }))?.interval, 2);
eq("describe weekly byDay", describeRule({ freq: "weekly", interval: 1, byDay: [1, 3], mode: "dueDate" }), "Weekly on Mon, Wed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
