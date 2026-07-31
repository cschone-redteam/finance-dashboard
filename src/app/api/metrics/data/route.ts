import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const { data: dealMetrics } = await supabaseAdmin
    .from("quarterly_deal_metrics")
    .select("*")
    .order("quarter");

  const { data: pnlData } = await supabaseAdmin
    .from("quarterly_pnl")
    .select("*")
    .order("quarter");

  return NextResponse.json({
    dealMetrics: dealMetrics || [],
    pnlData: pnlData || [],
  });
}
