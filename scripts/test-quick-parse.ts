import { parseQuickAdd } from "@/lib/todo/quick-parse";

const TODAY = "2026-06-02"; // a Tuesday

const cases: [string, Partial<ReturnType<typeof parseQuickAdd>>][] = [
  ["Buy milk", { title: "Buy milk", priority: 0, dueDate: null, dueTime: null }],
  ["Buy milk tomorrow", { title: "Buy milk", dueDate: "2026-06-03" }],
  ["Call mom today 3pm", { title: "Call mom", dueDate: "2026-06-02", dueTime: "15:00" }],
  ["Submit report !!! friday", { title: "Submit report", priority: 3, dueDate: "2026-06-05" }],
  ["pay rent !high ~Finance", { title: "pay rent", priority: 3, listName: "Finance" }],
  ["standup 9 am #work #daily", { title: "standup", dueTime: "09:00", dueDate: "2026-06-02", tags: ["work", "daily"] }],
  ["dentist jun 19", { title: "dentist", dueDate: "2026-06-19" }],
  ["dentist 19 jun", { title: "dentist", dueDate: "2026-06-19" }],
  ["trip in 3 days", { title: "trip", dueDate: "2026-06-05" }],
  ["review next monday !med", { title: "review", dueDate: "2026-06-08", priority: 2 }],
  ["tonight gym", { title: "gym", dueDate: "2026-06-02", dueTime: "21:00" }],
  ["plan ~\"Side Project\" 15:30", { title: "plan", listName: "Side Project", dueTime: "15:30" }],
  ["old date jan 1", { title: "old date", dueDate: "2027-01-01" }],
  ["finish deck !! at 5pm", { title: "finish deck", priority: 2, dueTime: "17:00", dueDate: "2026-06-02" }],
  ["done!", { title: "done!", priority: 0 }],
];

let pass = 0, fail = 0;
for (const [input, expect] of cases) {
  const got = parseQuickAdd(input, TODAY);
  const mismatches: string[] = [];
  for (const k of Object.keys(expect) as (keyof typeof expect)[]) {
    const e = JSON.stringify(expect[k]);
    const g = JSON.stringify(got[k]);
    if (e !== g) mismatches.push(`${k}: expected ${e}, got ${g}`);
  }
  if (mismatches.length) {
    fail++;
    console.log(`FAIL "${input}"`);
    for (const m of mismatches) console.log(`     ${m}`);
    console.log(`     full: ${JSON.stringify(got)}`);
  } else {
    pass++;
    console.log(`ok   "${input}" -> "${got.title}"`);
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
