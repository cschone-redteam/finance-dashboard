import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchProfitAndLoss,
  fetchProfitAndLossByClass,
  fetchClasses,
  parseProfitAndLossReport,
  getConnectedRealm,
} from "@/lib/qbo";

export async function POST(request: NextRequest) {
  const { quarter } = await request.json();

  if (!quarter) {
    return NextResponse.json(
      { error: "quarter is required (e.g. 2025-Q1)" },
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

  const [year, q] = quarter.split("-Q");
  const qNum = parseInt(q);
  const startMonth = (qNum - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(parseInt(year), endMonth, 0).getDate();
  const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`;

  try {
    const [report, classes] = await Promise.all([
      fetchProfitAndLoss(realmId, startDate, endDate),
      fetchClasses(realmId),
    ]);
    const sections = parseProfitAndLossReport(report);

    let revenue = 0;
    let cogs = 0;
    let totalExpenses = 0;
    let interest = 0;
    let taxes = 0;
    let depreciation = 0;
    let netIncome = 0;

    for (const s of sections) {
      const name = s.section.toLowerCase();
      if (name.includes("income") || name.includes("revenue")) {
        revenue += s.total;
      } else if (name.includes("cost of goods") || name.includes("cogs")) {
        cogs += Math.abs(s.total);
      } else if (name.includes("expense")) {
        totalExpenses += Math.abs(s.total);
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

    let smExpenses = 0;
    const smClass = classes.find(
      (c) => c.FullyQualifiedName === "Sales and Marketing"
    );
    if (smClass) {
      const smReport = await fetchProfitAndLossByClass(
        realmId, startDate, endDate, smClass.Id
      );
      const smSections = parseProfitAndLossReport(smReport);
      for (const s of smSections) {
        const name = s.section.toLowerCase();
        if (name.includes("expense") || name.includes("cost of goods") || name.includes("cogs")) {
          smExpenses += Math.abs(s.total);
        }
      }
    }

    const pnlRow = {
      quarter,
      revenue,
      cogs,
      gross_profit: grossProfit,
      operating_expenses: totalExpenses,
      sm_expenses: smExpenses,
      net_income: finalNetIncome,
      interest,
      taxes,
      depreciation_amortization: depreciation,
      ebitda,
      source: "qbo",
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("live_pnl")
      .upsert(pnlRow, { onConflict: "quarter" });

    if (error) throw error;

    return NextResponse.json(pnlRow);
  } catch (err) {
    console.error("Live P&L sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "P&L sync failed" },
      { status: 500 }
    );
  }
}
