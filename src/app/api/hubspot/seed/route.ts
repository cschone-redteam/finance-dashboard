import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const HUBSPOT_MONTHLY_DATA = [
  { year_month: "2024-01", deals_won: 8, total_revenue: 116040, total_arr: 116040 },
  { year_month: "2024-02", deals_won: 7, total_revenue: 65835, total_arr: 65835 },
  { year_month: "2024-03", deals_won: 14, total_revenue: 204012, total_arr: 204012 },
  { year_month: "2024-04", deals_won: 9, total_revenue: 106000, total_arr: 106000 },
  { year_month: "2024-05", deals_won: 5, total_revenue: 73800, total_arr: 73800 },
  { year_month: "2024-06", deals_won: 10, total_revenue: 94803, total_arr: 94803 },
  { year_month: "2024-07", deals_won: 5, total_revenue: 51964, total_arr: 51964 },
  { year_month: "2024-08", deals_won: 13, total_revenue: 182607, total_arr: 182607 },
  { year_month: "2024-09", deals_won: 6, total_revenue: 52470, total_arr: 52470 },
  { year_month: "2024-10", deals_won: 10, total_revenue: 166110, total_arr: 166110 },
  { year_month: "2024-11", deals_won: 6, total_revenue: 67358, total_arr: 64950 },
  { year_month: "2024-12", deals_won: 13, total_revenue: 152197, total_arr: 152197 },
  { year_month: "2025-01", deals_won: 3, total_revenue: 32915, total_arr: 33915 },
  { year_month: "2025-02", deals_won: 4, total_revenue: 53362, total_arr: 53362 },
  { year_month: "2025-03", deals_won: 10, total_revenue: 144432, total_arr: 157884 },
  { year_month: "2025-04", deals_won: 8, total_revenue: 91661, total_arr: 91661 },
  { year_month: "2025-05", deals_won: 10, total_revenue: 108634, total_arr: 131275 },
  { year_month: "2025-06", deals_won: 9, total_revenue: 82432, total_arr: 81832 },
  { year_month: "2025-07", deals_won: 12, total_revenue: 156696, total_arr: 236183 },
  { year_month: "2025-08", deals_won: 11, total_revenue: 106344, total_arr: 106344 },
  { year_month: "2025-09", deals_won: 11, total_revenue: 105136, total_arr: 105136 },
  { year_month: "2025-10", deals_won: 8, total_revenue: 175407, total_arr: 175407 },
  { year_month: "2025-11", deals_won: 10, total_revenue: 116290, total_arr: 116290 },
  { year_month: "2025-12", deals_won: 11, total_revenue: 119333, total_arr: 119333 },
  { year_month: "2026-01", deals_won: 6, total_revenue: 61057, total_arr: 61057 },
  { year_month: "2026-02", deals_won: 5, total_revenue: 55269, total_arr: 55269 },
  { year_month: "2026-03", deals_won: 11, total_revenue: 166061, total_arr: 166061 },
  { year_month: "2026-04", deals_won: 3, total_revenue: 31554, total_arr: 31554 },
  { year_month: "2026-05", deals_won: 11, total_revenue: 127552, total_arr: 127552 },
  { year_month: "2026-06", deals_won: 6, total_revenue: 75155, total_arr: 75155 },
  { year_month: "2026-07", deals_won: 2, total_revenue: 19600, total_arr: 19600 },
];

export async function POST() {
  try {
    const { error } = await supabaseAdmin
      .from("hs_revenue_summary")
      .upsert(
        HUBSPOT_MONTHLY_DATA.map((d) => ({
          ...d,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "year_month" }
      );

    if (error) throw error;

    return NextResponse.json({
      seeded: HUBSPOT_MONTHLY_DATA.length,
      months: HUBSPOT_MONTHLY_DATA.map((d) => d.year_month),
    });
  } catch (err) {
    console.error("HubSpot seed error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
