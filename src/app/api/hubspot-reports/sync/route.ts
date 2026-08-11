import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  syncChurnDeals,
  syncRenewalDeals,
  syncBookingsDeals,
  syncArrStack,
} from "@/lib/hubspot";

async function upsertReport(reportType: string, rows: Record<string, string | null>[]) {
  const { error } = await supabaseAdmin
    .from("hubspot_report_cache")
    .upsert(
      {
        report_type: reportType,
        rows,
        row_count: rows.length,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "report_type" },
    );
  if (error) throw new Error(`Supabase error for ${reportType}: ${error.message}`);
  return rows.length;
}

export async function POST() {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "HUBSPOT_ACCESS_TOKEN is not configured in .env.local" },
      { status: 500 },
    );
  }

  const results: Record<string, { count: number } | { error: string }> = {};

  const reports = [
    { key: "churn", fn: syncChurnDeals },
    { key: "renewals", fn: syncRenewalDeals },
    { key: "bookings", fn: syncBookingsDeals },
    { key: "arr-stack", fn: syncArrStack },
  ] as const;

  for (const { key, fn } of reports) {
    try {
      const rows = await fn();
      const count = await upsertReport(key, rows);
      results[key] = { count };
    } catch (err) {
      console.error(`HubSpot sync error (${key}):`, err);
      results[key] = {
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  const hasErrors = Object.values(results).some((r) => "error" in r);
  return NextResponse.json(
    { results, synced_at: new Date().toISOString() },
    { status: hasErrors ? 207 : 200 },
  );
}
