import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchProfitAndLoss,
  fetchBalanceSheet,
  parseProfitAndLossReport,
  parseBalanceSheetReport,
  getConnectedRealm,
} from "@/lib/qbo";

function buildPnLLineItems(
  sections: { section: string; accounts: { name: string; amount: number }[]; total: number }[]
) {
  let revenue = 0;
  let cogs = 0;
  let totalExpenses = 0;
  let interest = 0;
  let taxes = 0;
  let depreciation = 0;
  let netIncome = 0;

  const revenueAccounts: { name: string; amount: number }[] = [];
  const cogsAccounts: { name: string; amount: number }[] = [];
  const expenseAccounts: { name: string; amount: number }[] = [];

  for (const s of sections) {
    const name = s.section.toLowerCase();
    if (name.includes("income") || name.includes("revenue")) {
      revenue += s.total;
      revenueAccounts.push(...s.accounts);
    } else if (name.includes("cost of goods") || name.includes("cogs")) {
      cogs += Math.abs(s.total);
      cogsAccounts.push(...s.accounts);
    } else if (name.includes("expense")) {
      totalExpenses += Math.abs(s.total);
      expenseAccounts.push(...s.accounts);
      for (const acct of s.accounts) {
        const an = acct.name.toLowerCase();
        if (an.includes("interest")) interest += Math.abs(acct.amount);
        if (an.includes("depreciation") || an.includes("amortization"))
          depreciation += Math.abs(acct.amount);
        if (an.includes("tax") && !an.includes("payroll"))
          taxes += Math.abs(acct.amount);
      }
    } else if (name.includes("net income") || name.includes("net operating")) {
      netIncome = s.total;
    }
  }

  const grossProfit = revenue - cogs;
  const derivedNetIncome = revenue - cogs - totalExpenses;
  const finalNetIncome = netIncome !== 0 ? netIncome : derivedNetIncome;
  const ebitda = finalNetIncome + interest + taxes + depreciation;

  return {
    revenue: {
      total: revenue,
      accounts: revenueAccounts,
    },
    cogs: {
      total: cogs,
      accounts: cogsAccounts,
    },
    gross_profit: grossProfit,
    gross_margin_pct: revenue !== 0 ? grossProfit / revenue : 0,
    opex: {
      total: totalExpenses,
      accounts: expenseAccounts,
    },
    ebitda,
    depreciation,
    interest,
    taxes,
    net_income: finalNetIncome,
  };
}

function buildBSLineItems(
  sections: { section: string; accounts: { name: string; amount: number }[]; total: number }[]
) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  const assetSections: { name: string; total: number; accounts: { name: string; amount: number }[] }[] = [];
  const liabilitySections: { name: string; total: number; accounts: { name: string; amount: number }[] }[] = [];
  const equitySections: { name: string; total: number; accounts: { name: string; amount: number }[] }[] = [];

  for (const s of sections) {
    const name = s.section.toLowerCase();
    if (name.includes("asset")) {
      totalAssets += s.total;
      assetSections.push({ name: s.section, total: s.total, accounts: s.accounts });
    } else if (name.includes("liabilit")) {
      totalLiabilities += s.total;
      liabilitySections.push({ name: s.section, total: s.total, accounts: s.accounts });
    } else if (name.includes("equity") || name.includes("stockholder") || name.includes("shareholder")) {
      totalEquity += s.total;
      equitySections.push({ name: s.section, total: s.total, accounts: s.accounts });
    }
  }

  return {
    assets: {
      total: totalAssets,
      sections: assetSections,
    },
    liabilities: {
      total: totalLiabilities,
      sections: liabilitySections,
    },
    equity: {
      total: totalEquity,
      sections: equitySections,
    },
    total_liabilities_equity: totalLiabilities + totalEquity,
  };
}

function dateRangeForMonth(ym: string): { startDate: string; endDate: string } {
  const [year, month] = ym.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { startDate, endDate };
}

function priorYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${parseInt(y) - 1}-${m}`;
}

function priorMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

async function syncMonth(
  realmId: string,
  yearMonth: string,
  entity: string
) {
  const { startDate, endDate } = dateRangeForMonth(yearMonth);

  const [pnlReport, bsReport] = await Promise.all([
    fetchProfitAndLoss(realmId, startDate, endDate),
    fetchBalanceSheet(realmId, startDate, endDate),
  ]);

  const pnlSections = parseProfitAndLossReport(pnlReport);
  const bsSections = parseBalanceSheetReport(bsReport);

  const pnlLineItems = buildPnLLineItems(pnlSections);
  const bsLineItems = buildBSLineItems(bsSections);

  const rawPnlSections = pnlSections.map((s) => ({
    section: s.section,
    total: s.total,
    accounts: s.accounts,
  }));
  const rawBsSections = bsSections.map((s) => ({
    section: s.section,
    total: s.total,
    accounts: s.accounts,
  }));

  const now = new Date().toISOString();

  const { error: pnlErr } = await supabaseAdmin
    .from("monthly_financials")
    .upsert(
      {
        year_month: yearMonth,
        entity,
        report_type: "pnl",
        line_items: pnlLineItems,
        raw_sections: rawPnlSections,
        synced_at: now,
      },
      { onConflict: "year_month,entity,report_type" }
    );

  if (pnlErr) throw pnlErr;

  const { error: bsErr } = await supabaseAdmin
    .from("monthly_financials")
    .upsert(
      {
        year_month: yearMonth,
        entity,
        report_type: "bs",
        line_items: bsLineItems,
        raw_sections: rawBsSections,
        synced_at: now,
      },
      { onConflict: "year_month,entity,report_type" }
    );

  if (bsErr) throw bsErr;

  return { pnl: pnlLineItems, bs: bsLineItems, synced_at: now };
}

export async function POST(request: NextRequest) {
  const { yearMonth, entity = "RTS" } = await request.json();

  if (!yearMonth) {
    return NextResponse.json(
      { error: "yearMonth is required (e.g. 2026-06)" },
      { status: 400 }
    );
  }

  const realmId = await getConnectedRealm();
  if (!realmId) {
    return NextResponse.json(
      { error: "QuickBooks not connected" },
      { status: 401 }
    );
  }

  try {
    const pyMonth = priorYearMonth(yearMonth);
    const pmMonth = priorMonth(yearMonth);

    const monthsToSync = [yearMonth, pyMonth];
    if (pmMonth !== pyMonth) {
      monthsToSync.push(pmMonth);
    }

    const results = await Promise.all(
      monthsToSync.map((m) => syncMonth(realmId, m, entity).then((r) => ({ month: m, ...r })))
    );

    const primary = results.find((r) => r.month === yearMonth)!;

    return NextResponse.json({
      yearMonth,
      entity,
      pnl: primary.pnl,
      bs: primary.bs,
      synced_at: primary.synced_at,
      also_synced: monthsToSync.filter((m) => m !== yearMonth),
    });
  } catch (err) {
    console.error("Financial sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Financial sync failed" },
      { status: 500 }
    );
  }
}
