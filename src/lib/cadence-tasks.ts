export type Cadence = "daily" | "weekly" | "semi-monthly" | "monthly" | "annual";

export const GUIDES = {
  "aps-payroll": { name: "APS Payroll", file: "APS Payroll - Step-by-Step Task Guide.pdf" },
  "ramp": { name: "Ramp Corporate Cards", file: "Ramp Corporate Cards - Step-by-Step Task Guide.pdf" },
  "wise": { name: "Wise Contractor Payments", file: "Wise Contractor Payments - Step-by-Step Task Guide.pdf" },
  "revrec": { name: "RevRec + Deferred Revenue", file: "RevRec + Deferred Revenue - Step-by-Step Task Guide.pdf" },
  "go-billing": { name: "RedTeam Go Billing", file: "RedTeam Go Billing - Step-by-Step Task Guide.pdf" },
  "flex-billing": { name: "RedTeam Flex Billing", file: "RedTeam Flex Billing - Step-by-Step Task Guide.pdf" },
  "vendor-payments": { name: "Vendor Payments", file: "Vendor Payments - Step-by-Step Task Guide.pdf" },
  "cash-receipts": { name: "Cash Receipts & Application", file: "Cash Receipts & Application - Step-by-Step Task Guide.pdf" },
  "month-end-close": { name: "Month-end Close", file: "Month-end Close - Step-by-Step Task Guide.pdf" },
  "proforma": { name: "Proforma Financial Model", file: "Proforma Financial Model - Step-by-Step Task Guide.pdf" },
  "guide-index": { name: "Guide Index", file: "RedTeam Finance - Guide Index.pdf" },
} as const;

export type GuideKey = keyof typeof GUIDES;

export type CadenceTask = {
  id: string;
  description: string;
  cadence: Cadence;
  category: string;
  group?: string;
  timing?: string;
  notes?: string[];
  guides?: GuideKey[];
};

export type ProjectItem = {
  id: string;
  name: string;
  status: string;
};

export const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  "semi-monthly": "Semi-monthly",
  monthly: "Monthly",
  annual: "Annual",
};

export const CADENCE_ORDER: Cadence[] = [
  "daily",
  "weekly",
  "semi-monthly",
  "monthly",
  "annual",
];

export const CADENCE_TASKS: CadenceTask[] = [
  // Daily
  {
    id: "d1",
    description: "Respond to calls and emails",
    cadence: "daily",
    category: "Communication",
    notes: [
      "Set up RingCentral for accounting calls (~5-10 calls/week)",
    ],
  },
  {
    id: "d2",
    description: "Answer and respond to all incoming accounting calls (ext. 4)",
    cadence: "daily",
    category: "Phone",
    group: "Phone",
  },
  {
    id: "d3",
    description: "Accounting correspondence (accounting@redteam.com)",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
    notes: [
      "Inbox organized with RedTeam and Paser folders/labels",
      "Bracket-break notices and sent-invoice records flow through this inbox",
    ],
  },
  {
    id: "d4",
    description: "HS Notifications",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
    notes: [
      "New deals and renewals land as HubSpot notifications (e.g. 'Deal Closed Won')",
      "Click 'View at HubSpot' to open the deal, then find the PandaDoc service agreement",
      "Triggers new client setup in Go Manager and invoicing in QBO",
    ],
  },
  {
    id: "d5",
    description: "Client inquiries",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
    notes: [
      "For missing invoice requests: use Send / Send reminder from QBO",
      "For payment requests: Share invoice link, copy the link into your email reply",
    ],
  },
  {
    id: "d6",
    description: "Vendor inquiries",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
  },
  {
    id: "d7",
    description: "Client payment correspondence",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
    notes: [
      "Returned/disputed payments occur 1-2x per month",
      "Always email the client on returned payments",
      "Research in Merchant Service Center (gear > Account settings > Payments > View)",
    ],
  },
  {
    id: "d8",
    description: "Client collections correspondence",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
    notes: [
      "System auto-sends at 15/30/45 days",
      "Manual follow-up at 30+ days",
    ],
  },
  {
    id: "d9",
    description: "Fieldlens - Recurly correspondence",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
    notes: [
      "Fieldlens Recurly revenue is deferred via a separate journal entry",
      "Exclude Recurly lines from the Flex deferred revenue export to avoid double-counting",
    ],
  },
  {
    id: "d10",
    description: "HR — scanned mail received Orlando (Payroll Tax, Sales Tax, WC, etc.)",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
  },
  {
    id: "d11",
    description: "Controller correspondence",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
  },
  {
    id: "d12",
    description: "Department correspondence",
    cadence: "daily",
    category: "Email",
    group: "Email Correspondence",
  },
  {
    id: "d13",
    description: "Review bank activity in QBO",
    cadence: "daily",
    category: "Banking",
    guides: ["cash-receipts"],
    notes: [
      "Match bank feed daily — never blind-match",
      "Use 'Find other matches' when one deposit covers several checks",
      "Review daily positive pay exceptions (OFB)",
      "Match bank feed difference must be zero",
    ],
  },
  {
    id: "d14",
    description: "Record vendor bills and obtain approvals",
    cadence: "daily",
    category: "AP",
    guides: ["vendor-payments"],
    notes: [
      "Enter every vendor bill before starting month-end close (hard rule)",
      "Craig must approve every ACH and wire before it goes out",
      "Business bill pay: reference number goes back to QBO",
      "ACH: VIP authorization app, pending Craig approval",
    ],
  },
  {
    id: "d15",
    description: "Record client invoices (renewal billing from HS notification)",
    cadence: "daily",
    category: "AR",
    guides: ["go-billing", "flex-billing"],
    notes: [
      "New clients must have Go Manager billing fields + QBO ID set before the 25th",
      "Flex: read Expected APV and terms from PandaDoc service agreement",
      "Attach signed service agreement + W-9 to every invoice",
      "Add invoice notes: pricing type, APV, term dates, and cadence",
    ],
  },
  {
    id: "d16",
    description: "Record client payments and apply to invoices",
    cadence: "daily",
    category: "AR",
    guides: ["cash-receipts", "go-billing"],
    notes: [
      "Apply deposits daily from deposit log (Susie logs checks at Orlando office)",
      "Payment date = deposit date",
      "No remittance advice: apply to oldest outstanding invoice",
      "Code reversals identically to original (same account + class) to offset",
      "Payments auto-apply via Intuit portal; no auto-draws — clients pay via link",
    ],
  },

  // Weekly
  {
    id: "w1",
    description: "Pay vendor bills based on AP Invoice Aging (each Friday)",
    cadence: "weekly",
    category: "AP",
    timing: "Every Friday morning",
    guides: ["vendor-payments"],
    notes: [
      "Moving to Thursday — check current schedule",
      "Email payment list to Craig with notes on new/unusual vendors",
      "Mark each payment as paid in QBO immediately (prevents double-pay)",
      "Save payment file to Accounting RTS > AP > 2026",
      "Keep >= $20K reserve in Paser bank account",
      "FX wires via CorePay for international vendors",
      "Inter-company transfers: Paser to RedTeam via Pinnacle Bank wire (email template to Scotty/Michael, cc Craig and Connor)",
    ],
  },
  {
    id: "w2",
    description: "Create invoices — Recurring",
    cadence: "weekly",
    category: "AR",
    group: "AR Invoicing",
    guides: ["flex-billing"],
    notes: [
      "Check Settings > Recurring transactions in QBO; filter Type = Invoice",
      "Recurring bills auto-generate on the 25th — verify amounts are correct",
    ],
  },
  {
    id: "w3",
    description: "Create invoices — Manual (create / review APV)",
    cadence: "weekly",
    category: "AR",
    group: "AR Invoicing",
    guides: ["flex-billing"],
    notes: [
      "For Flex tiered pricing: look up client APV and apply correct bracket/overage rate",
      "Duplicate last month's invoice, update service date and class",
      "Invoice line recipe: RedTeam Flex Tiered Pricing, qty 12 (annual), class = Subscription New/Renewal",
    ],
  },

  // Semi-monthly
  {
    id: "sm1",
    description: "Pay employees via APS on 15th and last day of month",
    cadence: "semi-monthly",
    category: "Payroll",
    timing: "Submit 2 days prior, by 3:00 PM Central",
    guides: ["aps-payroll"],
    notes: [
      "Paydays: 1st and 15th. The 15th pays the 1st-15th; the 1st pays 16th-EOM",
      "Weekend/holiday payday: move to the preceding business day",
      "You may start the batch the evening before, as long as all inputs are approved",
      "Two-stage submission: first Submit unlocks reporting, then Final Submission after Craig/Susie sign off",
      "If a serious error slips through after final submission, call APS — they can undo the batch",
    ],
  },
  {
    id: "sm2",
    description: "Coordinate with HR — exceptions",
    cadence: "semi-monthly",
    category: "Payroll",
    group: "Payroll Processing",
    guides: ["aps-payroll"],
    notes: [
      "Use the Payroll Exceptions Google Sheet — shared record of everything unusual",
      "Susie (HR): starts/stops, severance, benefits, raises, promotions, address changes",
      "Connor: bonuses/commissions and PTO (pull PTO from approved time)",
      "Keep backup documentation for every commission/bonus entry",
      "For leave/severance: zero the rate and benefit deductions in APS",
    ],
  },
  {
    id: "sm3",
    description: "Attendance — verify to Redzone",
    cadence: "semi-monthly",
    category: "Payroll",
    group: "Payroll Processing",
    guides: ["aps-payroll"],
    notes: [
      "In APS: Attendance > Approve Time Cards — review Unapproved/Approved/No-time counts",
      "Compare PTO/holiday entries against the Red Zone calendar",
      "PTO tracked in hours (unlimited PTO, but hours tracked for 401(k) and benefit eligibility)",
      "Load Default Hours: reduce by holiday hours, do NOT reduce by PTO",
    ],
  },
  {
    id: "sm4",
    description: "Commission — monthly sales",
    cadence: "semi-monthly",
    category: "Payroll",
    group: "Payroll Processing",
    timing: "Paid on the 15th for the prior month",
    guides: ["aps-payroll"],
    notes: [
      "July 15th pays June commissions",
      "New-hire commissions: 100% guarantee for the first three months",
    ],
  },
  {
    id: "sm5",
    description: "Bonus — quarterly CX, Marketing, G&A",
    cadence: "semi-monthly",
    category: "Payroll",
    group: "Payroll Processing",
    guides: ["aps-payroll"],
    notes: [
      "Sales bonuses: monthly",
      "Marketing bonuses: quarterly",
      "Product & G&A bonuses: annually",
    ],
  },
  {
    id: "sm6",
    description: "Export from APS and import to QBO",
    cadence: "semi-monthly",
    category: "Payroll",
    group: "Payroll Processing",
    guides: ["aps-payroll"],
    notes: [
      "After submission: export General Ledger report from APS to Excel",
      "Clean the file: remove zero rows, consolidate bank amounts into one bank-activity line",
      "Match account/department names exactly to previous month (naming mismatches cause import errors)",
      "Upload to QBO via SaaSAnt: Bulk Upload > Journal Entries > drag and drop",
      "Verify in QBO: Reports > P&L by months, open a payroll line to confirm the entry posted",
      "Run Payroll Summary Audit (include employer tax, group by base dept) — send PDF to Craig & Susie",
    ],
  },

  // Monthly
  {
    id: "m1",
    description: "Month-end close",
    cadence: "monthly",
    category: "GL",
    timing: "First 4-5 business days of the following month",
    guides: ["month-end-close"],
    notes: [
      "Accuracy over speed — take the full 4-5 days",
      "Hard rule: enter every vendor bill and customer invoice before starting",
      "Team Player invoices: send on the 1st via Batch actions",
      "Reconcile bank accounts daily/weekly, finish before closing",
      "Financial package per company: P&L (also by class), Balance Sheet, AR aging, Allowance for doubtful accounts",
      "Maintain month-end close folders and documents",
    ],
  },
  {
    id: "m2",
    description: "Intercompany transactions",
    cadence: "monthly",
    category: "GL",
    guides: ["month-end-close", "vendor-payments"],
    notes: [
      "Shared costs (e.g. AWS) charged from RedTeam Software to Paser during close",
      "Inter-company transfers: Paser to RedTeam via Pinnacle Bank wire",
      "Email template to Scotty/Michael, cc Craig and Connor",
    ],
  },
  {
    id: "m3",
    description: "Intra-company transactions",
    cadence: "monthly",
    category: "GL",
  },
  {
    id: "m4",
    description: "Balance sheet reconciliations",
    cadence: "monthly",
    category: "Reconciliation",
    guides: ["month-end-close"],
    notes: [
      "EOM Statements: reconcile each bank account in QBO",
      "Reconcile daily/weekly throughout the month, finish before close",
    ],
  },
  {
    id: "m5",
    description: "Entity financials (RTS, PASKR)",
    cadence: "monthly",
    category: "Reporting",
    guides: ["month-end-close"],
    notes: [
      "P&L (total and by class), Balance Sheet, AR aging, Allowance for doubtful accounts",
      "Revenue classes vary by entity: Paser = Paser/Param-zero; RedTeam = Fieldlens, Team Player, Flex (New/Renewal)",
      "Payment fees go to Operating class",
    ],
  },
  {
    id: "m6",
    description: "Consolidation (RTP)",
    cadence: "monthly",
    category: "Consolidation",
    guides: ["month-end-close"],
    notes: [
      "'Just Consolidate' for RTP after entity financials are complete",
    ],
  },
  {
    id: "m7",
    description: "Elimination entries",
    cadence: "monthly",
    category: "Consolidation",
    guides: ["month-end-close"],
    notes: [
      "Record during consolidation to remove intercompany balances",
    ],
  },
  {
    id: "m8",
    description: "Update Proforma actuals",
    cadence: "monthly",
    category: "Reporting",
    timing: "After month-end close; email Allen on 1st for APV report",
    guides: ["proforma"],
    notes: [
      "Paste QBO P&L into P&L Actual tab, enter month-end date, drag formulas down",
      "Use entity-level P&Ls (not just consolidated) for detail like broken-out discounts",
      "Refresh HubSpot tabs: ARR stack, customer list, renewals, churn — extend filters to current month",
      "Update bookings: export YTD from HubSpot, paste only current month's rows",
      "Reconcile renewals/churn to CX forecast sheet; classify: price increase / expansion / downsell",
      "If lookups break, check for changed HubSpot company IDs first (most common breakage)",
      "ARR stack shows paying clients only — non-paying won't appear",
    ],
  },
  {
    id: "m9",
    description: "Department meetings",
    cadence: "monthly",
    category: "Communication",
    notes: [
      "Distribute Consolidated Actual vs Budget to department managers",
    ],
  },
  {
    id: "m10",
    description: "Manage Fieldlens customer and invoicing",
    cadence: "monthly",
    category: "Recurly",
    group: "Recurly (Fieldlens)",
  },
  {
    id: "m11",
    description: "Fieldlens revenue recognition",
    cadence: "monthly",
    category: "Recurly",
    group: "Recurly (Fieldlens)",
    guides: ["revrec"],
    notes: [
      "Deferred via a separate journal entry — exclude Recurly lines from Flex deferred revenue export",
    ],
  },
  {
    id: "m12",
    description: "Fieldlens reporting",
    cadence: "monthly",
    category: "Recurly",
    group: "Recurly (Fieldlens)",
  },
  {
    id: "m13",
    description: "Review sales tax filings in Numeral",
    cadence: "monthly",
    category: "Sales Tax",
    group: "Sales Tax",
  },
  {
    id: "m14",
    description: "Run reports from RTS and PASKR QBO for sales tax",
    cadence: "monthly",
    category: "Sales Tax",
    group: "Sales Tax",
  },
  {
    id: "m15",
    description: "Compare QBO to Numeral — approve filings",
    cadence: "monthly",
    category: "Sales Tax",
    group: "Sales Tax",
  },
  {
    id: "m16",
    description: "Record remit and adjustments against Sales Tax Payable",
    cadence: "monthly",
    category: "Sales Tax",
    group: "Sales Tax",
  },
  {
    id: "m17",
    description: "Respond to Numeral request and 2FA",
    cadence: "monthly",
    category: "Sales Tax",
    group: "Sales Tax",
  },
  {
    id: "m18",
    description: "Review Numeral jurisdictions for nexus (new hires)",
    cadence: "monthly",
    category: "Sales Tax",
    group: "Sales Tax",
  },
  {
    id: "m19",
    description: "Manage contractor setup",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    guides: ["wise"],
    notes: [
      "Peru/Philippine contractors send invoices to accounting — update bill with their invoice number",
      "Some hold USD accounts (no conversion), some hold peso accounts",
      "Exceptions: Gerardo = ACH to FL bank; Ali Lozano = FX wire (bank can't take Wise)",
      "Remove departed contractors after final payment",
    ],
  },
  {
    id: "m20",
    description: "Forecast contractor payments",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    guides: ["wise"],
    notes: [
      "Typically ~$20K/month total, higher with quarterly incentives",
      "Quarterly incentives (e.g. Q2 = Apr-Jun) paid at end of the following month (July)",
    ],
  },
  {
    id: "m21",
    description: "Fund each Wise from respective entity bank account",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    timing: "~25th-26th of the month",
    guides: ["wise"],
    notes: [
      "Paser: funded by wire request to Pinnacle Bank (via Scotty)",
      "RedTeam: funded by wire from One Florida Bank Treasury Management",
      "Funds must be kept separate per entity — toggle balances in Wise",
    ],
  },
  {
    id: "m22",
    description: "Pay contractors (PHP & Peru)",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    timing: "After funding, ~25th-26th",
    guides: ["wise"],
    notes: [
      "Toggle to the correct entity balance before paying",
      "Enter USD amount; confirm converted amount matches target pay (adjust if exchange rate is off)",
      "Reference = contractor initials + month (copy prior month, change the month)",
      "If Wise asks whether reference is a person's name, reply 'no' (they hold the payment otherwise)",
    ],
  },
  {
    id: "m23",
    description: "Enter vendor bill in QBO",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    guides: ["wise"],
    notes: [
      "Recurring bills auto-generate on the 25th — don't trust the recurring amount (exchange rates + incentives change)",
      "Either update the created bill, or: Recurring transactions > skip next date > copy bill to enter manually",
    ],
  },
  {
    id: "m24",
    description: "Reflect vendor payment in QBO",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    guides: ["wise"],
    notes: [
      "CRUCIAL: change the bank account to Transfer Wise (not Pinnacle/One Florida)",
      "Enter the Wise reference number; break the fee out to bank charges",
      "Confirm amount + fee tie to the Wise transfer",
    ],
  },
  {
    id: "m25",
    description: "Reconcile Wise in each QBO",
    cadence: "monthly",
    category: "AP",
    group: "Wise — Foreign Contractors",
    guides: ["wise"],
    notes: [
      "Pull Wise statement: Home > Statements and reports > Create statement",
      "Select USD, date range for the month, export as PDF (English)",
      "Leave 'display transaction fees separately' unchecked",
      "Save to accounting folder and attach to bank reconciliation",
    ],
  },

  // Monthly — Billing (around the 25th)
  {
    id: "m26",
    description: "Go billing run — generate and send invoices",
    cadence: "monthly",
    category: "AR",
    group: "Monthly Billing (25th)",
    timing: "25th of the month",
    guides: ["go-billing"],
    notes: [
      "Mark Checked in QB first to clear existing credit-card activity",
      "Generate Billing > Send to QuickBooks — do NOT interrupt this process",
      "Verify import: search most recent client in Sales transactions",
      "Reconcile: run Sales by Customer Summary, export to Excel, compare months",
      "Exceptions: missing $50 integration fee, prepaid voids, churn write-offs, rejected payments",
      "Send invoices in batches — exclude voided; copy accounting@redteam.com",
      "If invoice didn't create: duplicate last month's, update date, verify lines",
    ],
  },
  {
    id: "m27",
    description: "Flex billing run — monthly/quarterly renewals",
    cadence: "monthly",
    category: "AR",
    group: "Monthly Billing (25th)",
    timing: "25th of the month (start prep 2-3 days before)",
    guides: ["flex-billing"],
    notes: [
      "Run Sales by Customer Summary for a full year to see each client's billing cadence",
      "Build pricing workbook: customize by Price type, stack in Excel, VLOOKUP price type onto full list",
      "Filter for 'deleted' names = churned; filter NA = missing price type (investigate)",
      "Work one pricing type at a time: capped (fixed price, no APV) first, then elastic, fixed, tiered",
      "Wait for recurring invoices to generate on the 25th, then batch send from Sales transactions",
      "Variance check: compare this month's invoices to last month's to spot big changes",
    ],
  },
  {
    id: "m28",
    description: "Deferred revenue / revenue recognition",
    cadence: "monthly",
    category: "GL",
    group: "Revenue Recognition",
    timing: "~Day 3 of the following month, after all invoicing is entered",
    guides: ["revrec"],
    notes: [
      "Two tracks: Go/Paser (quick JE) and Flex (deferred revenue file)",
      "Go/Paser: copy last month's JE > change date to 25th or month-end > debit Unearned, credit Sales",
      "Cross-check in Paser Financials workbook Unearned tab — drag formula down, confirm amounts match",
      "Flex: export P&L Total income from RTS QBO, add Class and Quantity columns",
      "Clean: remove title rows, Recurly lines, transaction fees, zero sales-tax lines",
      "Classify New/Renewal; convert quantities to positive (12 = annual, 3 = quarterly)",
      "Match account names exactly to prior month for the reference lookup",
      "Tie out: Go/Paser workbook + Flex file totals = deferred revenue on balance sheet",
    ],
  },
  {
    id: "m29",
    description: "Ramp — code transactions and sync to QBO",
    cadence: "monthly",
    category: "AR",
    group: "Ramp Corporate Cards",
    timing: "Statement auto-pays on the 22nd",
    guides: ["ramp"],
    notes: [
      "Filter transactions needing attention, set department + account coding, mark Ready",
      "Sync to QBO — vendor, class, account, and receipt carry over",
      "Receipts required over $25; under $25 does not require a receipt",
      "Use chat to clear up unclear or personal charges; flag personal charges for reversal",
      "Before reconciliation: confirm all statement-period transactions synced from Ramp to QBO",
      "In QBO: gear > Reconcile, reconcile card to statement (ending balance must match)",
      "Let rewards accumulate to $50K before applying to a statement",
    ],
  },

  // Annual
  {
    id: "a1",
    description: "Provide all PBC detail to auditors for fieldwork",
    cadence: "annual",
    category: "Audit",
    group: "Annual Audit",
  },
  {
    id: "a2",
    description: "Respond to all audit sample, confirmations, and test requests",
    cadence: "annual",
    category: "Audit",
    group: "Annual Audit",
  },
  {
    id: "a3",
    description: "Respond to all audit requests for information and questions",
    cadence: "annual",
    category: "Audit",
    group: "Annual Audit",
  },
  {
    id: "a4",
    description: "Record any adjustments on each entity, update consolidation, and update ProForma",
    cadence: "annual",
    category: "Audit",
    group: "Annual Audit",
  },
  {
    id: "a5",
    description: "Provide all PBC detail to tax preparers for completion of returns and K1s",
    cadence: "annual",
    category: "Tax Returns",
    group: "Tax Returns",
  },
  {
    id: "a6",
    description: "Respond to all tax requests for information and questions",
    cadence: "annual",
    category: "Tax Returns",
    group: "Tax Returns",
  },
  {
    id: "a7",
    description: "Review and sign C Corp return",
    cadence: "annual",
    category: "Tax Returns",
    group: "Tax Returns",
  },
  {
    id: "a8",
    description: "Review and sign LLC Partnership return",
    cadence: "annual",
    category: "Tax Returns",
    group: "Tax Returns",
  },
  {
    id: "a9",
    description: "Receive and distribute K1s to unit holders",
    cadence: "annual",
    category: "Tax Returns",
    group: "Tax Returns",
  },
];

export const ACTIVE_PROJECTS: ProjectItem[] = [
  {
    id: "p1",
    name: "Process Pro — HubSpot/CX: pull invoices & payments from QBO to HS for Gainsight",
    status: "Wrapping up",
  },
  {
    id: "p2",
    name: "Carta — Series D, P-1 Exchange, P-1 Issuance",
    status: "Starting",
  },
  {
    id: "p3",
    name: "2025 Audit — Partner review",
    status: "In progress",
  },
  {
    id: "p4",
    name: "2025 Tax Prep — All docs provided, waiting on audit",
    status: "Blocked",
  },
  {
    id: "p5",
    name: "409A — Need to initiate and complete for 2026 Audit",
    status: "Not started",
  },
];

export type DutyCategory = {
  name: string;
  duties: string[];
};

export const ACTIVITY_DUTIES: DutyCategory[] = [
  {
    name: "Banking",
    duties: [
      "Daily review and process bank activity in QBO",
      "Review daily positive pay exceptions (OFB)",
      "EOM Statements — Reconcile each in QBO",
    ],
  },
  {
    name: "AP",
    duties: [
      "Set up vendors (W9 — determine 1099 reporting)",
      "Enter vendor bills daily",
      "Pay vendor bills weekly (Vendor Detail Aging → Send for approval → OFB Bill Pay / ACH / Wires → Mark paid in QBO)",
      "EOY: 1099 reporting contractors; inactivate stale vendors",
      "Wise — Foreign contractor payments (PHP & Peru), fund from entity bank, reconcile",
    ],
  },
  {
    name: "AR",
    duties: [
      "Set up customers (notification from HS → update QBIDs in HS → contacts)",
      "Enter new deals and renewal deals daily",
      "Create monthly invoices on 25th (Elastic, Fixed, Tiered, Capped, Legacy)",
      "Invoicing — Recurring",
      "Invoicing — Manual (create / review APV)",
      "Attach service agreements",
      "Apply payments to invoices",
      "Monthly collections (System 15/30/45, Manual 30+)",
      "Reserve analysis, bad debt write-off, reclass to ADA",
      "Inactivate stale customers",
      "Recurly — manage Fieldlens customer invoicing and revenue recognition",
    ],
  },
  {
    name: "Payroll",
    duties: [
      "Semi-monthly — 3 days in advance (coordinate with HR, exceptions)",
      "Attendance — verify to Redzone",
      "Commission (monthly sales)",
      "Bonus (quarterly CX, Marketing, G&A)",
      "Export from APS and import to QBO",
      "State WH, SUI, DIS",
      "EOY reporting (W2, 1095)",
    ],
  },
  {
    name: "General Ledger",
    duties: [
      "Manage QBOs for RTS, PASKR, & RTP Consolidated (Users, Accounts, Classes, Products/Services)",
      "Month-end close list — manual entries (Accruals, Prepaid, Deferred Revenue, Reclasses, Other)",
      "Reports — review departments",
      "Reconcile all accounts",
      "Create entity financials → Consolidation (Just Consolidate for RTP) → Elimination → Review → Financials",
      "Complete the Actuals in the ProForma",
      "Distribute Consolidated Act vs Budget to department managers",
      "Maintain month-end close folders and documents",
    ],
  },
  {
    name: "Monthend Analysis",
    duties: [
      "Revenue by customer — RTS",
      "Revenue by customer — PASKR, Inc.",
      "Transaction revenue (Bracket Breaks, Percentage Contracts)",
    ],
  },
  {
    name: "Sales Tax",
    duties: [
      "Review sales tax filings in Numeral",
      "Run reports from RTS and PASKR QBO for sales tax",
      "Compare QBO to Numeral → Approve filings",
      "Record remit and adjustments against Sales Tax Payable",
      "Respond to Numeral request and 2FA",
      "Review Numeral jurisdictions for nexus (new hires)",
    ],
  },
  {
    name: "Ad Hoc Analysis",
    duties: [
      "Financial analysis",
      "Metric analysis",
      "Board Deck",
      "Management requests",
      "Department requests",
      "Ramp — Manage cards (send invites, issue physical/digital cards, lock accounts, transition card owners)",
      "Ramp — Manage spend (review transactions for receipts, request receipts, review/edit coding, approve, sync to QBO)",
      "Ramp — Reimbursements (review receipts, review/edit coding, approve, sync to QBO, reconcile accrued reimbursement)",
      "Ramp — Limits and bank statement uploads",
      "Ramp — Statement reconciliation (reconcile Ramp Payable account in QBO)",
    ],
  },
  {
    name: "Insurance / Risk",
    duties: [
      "Annual renewals — GL, WC, E&O, D&O, Cyber policies",
      "WC Policy Audit (following Oct term end)",
      "Update WC locations as they occur (terms and new hires)",
    ],
  },
  {
    name: "Carta",
    duties: [
      "Manage units and unit holders",
      "Create draft units, maintain PIU and 83B documents",
      "Coordinate sending 83B documents to tax office",
      "Run reports and reconcile with GL",
    ],
  },
  {
    name: "Compliance",
    duties: [
      "Annual audit — PBC detail, audit samples, confirmations, adjustments",
      "Annual tax returns — PBC detail, review and sign returns, distribute K1s",
      "Property tax — annual RTS",
      "Census reporting — quarterly",
    ],
  },
];

export function getTasksByCadence(): { cadence: Cadence; label: string; tasks: CadenceTask[] }[] {
  return CADENCE_ORDER.map((c) => ({
    cadence: c,
    label: CADENCE_LABELS[c],
    tasks: CADENCE_TASKS.filter((t) => t.cadence === c),
  }));
}
