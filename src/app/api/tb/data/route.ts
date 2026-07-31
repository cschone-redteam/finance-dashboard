import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearMonth = searchParams.get("yearMonth");
  const entity = searchParams.get("entity");

  if (!yearMonth) {
    return NextResponse.json(
      { error: "yearMonth is required" },
      { status: 400 }
    );
  }

  const snapshotQuery = supabaseAdmin
    .from("trial_balance_snapshots")
    .select("id, year_month, entity, synced_at")
    .eq("year_month", yearMonth);

  if (entity && entity !== "All") {
    snapshotQuery.eq("entity", entity);
  }

  const { data: snapshots } = await snapshotQuery;

  const { data: hsRevenue } = await supabaseAdmin
    .from("hs_revenue_summary")
    .select("*")
    .eq("year_month", yearMonth)
    .single();

  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ snapshot: null, rows: [], hsRevenue });
  }

  const snapshot = snapshots[0];

  const { data: rows } = await supabaseAdmin
    .from("trial_balance_rows")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .order("account_type")
    .order("account_name");

  return NextResponse.json({
    snapshot,
    rows: rows || [],
    hsRevenue,
  });
}
