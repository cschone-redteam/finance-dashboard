import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const { data: snapshots } = await supabaseAdmin
    .from("trial_balance_snapshots")
    .select("id, year_month, entity, synced_at")
    .order("year_month", { ascending: false });

  const { data: hsMonths } = await supabaseAdmin
    .from("hs_revenue_summary")
    .select("year_month")
    .order("year_month", { ascending: false });

  return NextResponse.json({
    snapshots: snapshots || [],
    hsMonths: (hsMonths || []).map((m) => m.year_month),
  });
}
