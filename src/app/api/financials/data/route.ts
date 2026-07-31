import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const entity = request.nextUrl.searchParams.get("entity") || "RTS";

  const { data: financials, error: finErr } = await supabaseAdmin
    .from("monthly_financials")
    .select("*")
    .eq("entity", entity)
    .order("year_month");

  if (finErr) {
    console.warn("monthly_financials query failed (table may not exist yet):", finErr.message);
  }

  let { data: dealMetrics } = await supabaseAdmin
    .from("live_deal_metrics")
    .select("*")
    .order("quarter");

  if (!dealMetrics || dealMetrics.length === 0) {
    const { data: quarterlyMetrics } = await supabaseAdmin
      .from("quarterly_deal_metrics")
      .select("*")
      .order("quarter");
    dealMetrics = quarterlyMetrics;
  }

  const pnlByMonth: Record<string, unknown> = {};
  const bsByMonth: Record<string, unknown> = {};

  for (const row of financials || []) {
    if (row.report_type === "pnl") {
      pnlByMonth[row.year_month] = {
        line_items: row.line_items,
        raw_sections: row.raw_sections,
        synced_at: row.synced_at,
      };
    } else if (row.report_type === "bs") {
      bsByMonth[row.year_month] = {
        line_items: row.line_items,
        raw_sections: row.raw_sections,
        synced_at: row.synced_at,
      };
    }
  }

  return NextResponse.json({
    pnl: pnlByMonth,
    bs: bsByMonth,
    dealMetrics: dealMetrics || [],
    months: [...new Set((financials || []).map((f) => f.year_month))].sort(),
  });
}
