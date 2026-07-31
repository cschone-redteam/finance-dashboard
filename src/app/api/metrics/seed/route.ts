import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { QUARTERLY_DEAL_DATA, PNL_SEED_DATA } from "@/lib/proforma";

export async function POST() {
  try {
    await supabaseAdmin.from("quarterly_deal_metrics").delete().neq("quarter", "");

    const { error } = await supabaseAdmin
      .from("quarterly_deal_metrics")
      .upsert(
        QUARTERLY_DEAL_DATA.map((d) => ({
          ...d,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "quarter" }
      );

    if (error) throw error;

    const { error: pnlError } = await supabaseAdmin
      .from("quarterly_pnl")
      .upsert(
        PNL_SEED_DATA.map((d) => ({
          ...d,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "quarter" }
      );

    if (pnlError) throw pnlError;

    return NextResponse.json({
      seeded: QUARTERLY_DEAL_DATA.length,
      quarters: QUARTERLY_DEAL_DATA.map((d) => d.quarter),
      pnl_seeded: PNL_SEED_DATA.length,
    });
  } catch (err) {
    console.error("Metrics seed error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 },
    );
  }
}
