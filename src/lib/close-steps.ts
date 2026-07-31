import type { CloseStepDef, DayGroup, Entity } from "./types";

function step(
  day: number,
  description: string,
  entity: Entity,
  category: string
): Omit<CloseStepDef, "index"> {
  return { day, description, entity, category };
}

const RAW_STEPS: Omit<CloseStepDef, "index">[] = [
  // Day -7
  step(-7, "Send month-end close notification", "All", "Notification"),
  step(-7, "Send Ramp Visa notification", "All", "Notification"),

  // Day -2
  step(-2, "Send Ramp Visa reminders", "All", "Notification"),

  // Day 1
  step(1, "Enter all vendor bills", "All", "AP"),
  step(1, "Enter all customer invoices", "All", "AR"),
  step(
    1,
    "Create AFSA and American Financial Services invoice for prior month",
    "All",
    "AR"
  ),
  step(1, "Send all TeamPlayer invoices", "RTS", "AR"),
  step(1, "Enter cash receipts", "All", "AR"),
  step(1, "Complete daily banking", "All", "Banking"),
  step(1, "Review transactions for no class and correct", "All", "GL"),
  step(1, "Reconcile Go bank accounts", "RTS", "Banking"),
  step(1, "Create and save Go ARR report", "RTS", "Reporting"),
  step(
    1,
    "Create and save Go Percentage Report and share with Success",
    "RTS",
    "Reporting"
  ),
  step(
    1,
    "Create and save Go Bracket Report and share with Success",
    "RTS",
    "Reporting"
  ),
  step(
    1,
    "Create and save Flex Team Player Report and share with Success",
    "RTS",
    "Reporting"
  ),
  step(1, "Update PASKR reconciliations", "PASKR", "Reconciliation"),
  step(1, "Update RedTeam intercompany", "RTS", "Intercompany"),
  step(1, "Update PASKR intercompany", "PASKR", "Intercompany"),

  // Day 2
  step(
    2,
    "Sync remaining Ramp transactions (including those with no receipt or memo)",
    "All",
    "Ramp"
  ),
  step(2, "Reconcile Flex bank accounts", "RTS", "Banking"),
  step(2, "Reconcile Ramp Statement", "All", "Ramp"),
  step(2, "Update RedTeam reconciliations", "RTS", "Reconciliation"),
  step(2, "Marketing Accrual", "All", "Accruals"),
  step(2, "Benefit Adjustment", "All", "Accruals"),
  step(2, "Interest Expense", "All", "Accruals"),
  step(2, "Review transactions for no class and correct", "All", "GL"),
  step(2, "Labor allocation", "All", "GL"),
  step(2, "Review BS and PL — PASKR", "PASKR", "Review"),
  step(2, "Review Department PL — PASKR", "PASKR", "Review"),
  step(2, "Review BS and PL — RTS", "RTS", "Review"),
  step(2, "Review Department PL — RTS", "RTS", "Review"),

  // Day 3
  step(3, "Related company transaction", "RTP", "Intercompany"),
  step(
    3,
    "I/C JE for temporary offset of related party transactions",
    "RTP",
    "Intercompany"
  ),
  step(3, "Stripe", "RTS", "Revenue"),
  step(3, "Fieldlens Recurly", "PASKR", "Revenue"),
  step(3, "Deferred Revenue", "All", "Revenue"),
  step(3, "PIU Unit Compensation Expense (year-end)", "All", "Accruals"),
  step(3, "Review BS and PL", "RTP", "Review"),
  step(3, "Review Department PL", "RTP", "Review"),
  step(3, "Capital Updates (exception)", "All", "GL"),
  step(3, "Convert Note (exception)", "All", "GL"),

  // Day 4
  step(4, "Complete PASKR Financial Package", "PASKR", "Financial Package"),
  step(4, "Complete RedTeam Financial Package", "RTS", "Financial Package"),
  step(
    4,
    "Delete prior consolidation records in RTP",
    "RTP",
    "Consolidation"
  ),
  step(4, "Consolidation", "RTP", "Consolidation"),
  step(4, "Elimination", "RTP", "Consolidation"),
  step(
    4,
    "Validate proper consolidation with RTS and PASKR BS",
    "RTP",
    "Consolidation"
  ),
  step(4, "Complete RTP Financial Package", "RTP", "Financial Package"),

  // Day 5
  step(5, "Update ProForma file", "RTP", "Reporting"),
  step(5, "Department Reports distributed", "All", "Reporting"),
];

export const CLOSE_STEPS: CloseStepDef[] = RAW_STEPS.map((s, i) => ({
  ...s,
  index: i,
}));

export const TOTAL_STEPS = CLOSE_STEPS.length;

const DAY_LABELS: Record<number, string> = {
  [-7]: "Day -7 (Pre-close)",
  [-2]: "Day -2 (Pre-close)",
  1: "Day 1",
  2: "Day 2",
  3: "Day 3",
  4: "Day 4",
  5: "Day 5",
};

export function getStepsByDay(): DayGroup[] {
  const days = [...new Set(CLOSE_STEPS.map((s) => s.day))];
  return days.map((day) => ({
    day,
    label: DAY_LABELS[day] ?? `Day ${day}`,
    steps: CLOSE_STEPS.filter((s) => s.day === day),
  }));
}
