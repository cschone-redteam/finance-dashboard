import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

interface DealRow {
  quarter: string;
  new_business_arr: number;
  new_business_count: number;
  expansion_arr: number;
  expansion_count: number;
  crosssell_arr: number;
  crosssell_count: number;
  renewal_arr: number;
  renewal_count: number;
  unassigned_arr: number;
  unassigned_count: number;
  total_closed_arr: number;
  total_closed_count: number;
  churned_arr: number;
  churned_count: number;
}

export async function POST(request: NextRequest) {
  try {
    const { deals, churn } = (await request.json()) as {
      deals: DealRow[];
      churn?: { quarter: string; churned_arr: number; churned_count: number }[];
    };

    if (!deals || !Array.isArray(deals)) {
      return NextResponse.json(
        { error: "deals array is required" },
        { status: 400 }
      );
    }

    const rows = deals.map((d) => {
      const churnRow = churn?.find((c) => c.quarter === d.quarter);
      return {
        ...d,
        churned_arr: churnRow?.churned_arr ?? d.churned_arr ?? 0,
        churned_count: churnRow?.churned_count ?? d.churned_count ?? 0,
        source: "hubspot",
        synced_at: new Date().toISOString(),
      };
    });

    const { error } = await supabaseAdmin
      .from("live_deal_metrics")
      .upsert(rows, { onConflict: "quarter" });

    if (error) throw error;

    return NextResponse.json({
      synced: rows.length,
      quarters: rows.map((r) => r.quarter),
    });
  } catch (err) {
    console.error("HubSpot sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
