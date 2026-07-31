import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchTrialBalance,
  parseTrialBalanceReport,
  getConnectedRealm,
} from "@/lib/qbo";

export async function POST(request: NextRequest) {
  const { yearMonth, entity } = await request.json();

  if (!yearMonth || !entity) {
    return NextResponse.json(
      { error: "yearMonth and entity are required" },
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

  const [year, month] = yearMonth.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  try {
    const report = await fetchTrialBalance(realmId, startDate, endDate);
    const parsedRows = parseTrialBalanceReport(report);

    // Delete existing snapshot for this period/entity if any
    const { data: existing } = await supabaseAdmin
      .from("trial_balance_snapshots")
      .select("id")
      .eq("year_month", yearMonth)
      .eq("entity", entity)
      .eq("realm_id", realmId)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("trial_balance_rows")
        .delete()
        .eq("snapshot_id", existing.id);
      await supabaseAdmin
        .from("trial_balance_snapshots")
        .delete()
        .eq("id", existing.id);
    }

    // Insert new snapshot
    const { data: snapshot, error: snapErr } = await supabaseAdmin
      .from("trial_balance_snapshots")
      .insert({
        year_month: yearMonth,
        entity,
        realm_id: realmId,
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (snapErr) throw snapErr;

    // Insert rows
    if (parsedRows.length > 0) {
      const rowsToInsert = parsedRows.map((r) => ({
        snapshot_id: snapshot.id,
        ...r,
      }));

      const { error: rowErr } = await supabaseAdmin
        .from("trial_balance_rows")
        .insert(rowsToInsert);

      if (rowErr) throw rowErr;
    }

    return NextResponse.json({
      snapshot_id: snapshot.id,
      rows_count: parsedRows.length,
      synced_at: snapshot.synced_at,
    });
  } catch (err) {
    console.error("QBO sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
