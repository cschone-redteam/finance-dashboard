import { NextResponse } from "next/server";
import { fetchInvoicesInRange, fetchPaymentsInRange } from "@/lib/qbo";
import { supabaseAdmin } from "@/lib/supabase-server";

const REALMS = [
  { id: "1223699155", entity: "flex" as const },
  { id: "791016560", entity: "go" as const },
];

export type EntityTotals = { flex: number; go: number; other: number; total: number };
export type MonthData = { invoiced: EntityTotals; collected: EntityTotals };
export type BillingData = Record<string, MonthData>;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("hubspot_report_cache")
      .select("rows, synced_at")
      .eq("report_type", "billing")
      .single();

    if (error || !data?.rows) {
      return NextResponse.json({ data: null, synced_at: null });
    }

    return NextResponse.json({ data: data.rows as BillingData, synced_at: data.synced_at });
  } catch {
    return NextResponse.json({ data: null, synced_at: null });
  }
}

export async function POST() {
  try {
    const startDate = "2025-01-01";
    const endDate = "2026-12-31";

    const results = await Promise.all(
      REALMS.map(async (realm) => {
        const [invoices, payments] = await Promise.all([
          fetchInvoicesInRange(realm.id, startDate, endDate),
          fetchPaymentsInRange(realm.id, startDate, endDate),
        ]);
        return { entity: realm.entity, invoices, payments };
      })
    );

    const months: BillingData = {};

    function getMonth(key: string): MonthData {
      if (!months[key]) {
        months[key] = {
          invoiced: { flex: 0, go: 0, other: 0, total: 0 },
          collected: { flex: 0, go: 0, other: 0, total: 0 },
        };
      }
      return months[key];
    }

    for (const { entity, invoices, payments } of results) {
      for (const inv of invoices) {
        const monthKey = inv.txnDate.slice(0, 7);
        if (!monthKey) continue;
        const m = getMonth(monthKey);
        m.invoiced[entity] += inv.totalAmt;
        m.invoiced.total += inv.totalAmt;
      }

      for (const pay of payments) {
        const monthKey = pay.txnDate.slice(0, 7);
        if (!monthKey) continue;
        const m = getMonth(monthKey);
        m.collected[entity] += pay.totalAmt;
        m.collected.total += pay.totalAmt;
      }
    }

    const syncedAt = new Date().toISOString();
    await supabaseAdmin.from("hubspot_report_cache").upsert(
      {
        report_type: "billing",
        rows: months,
        row_count: Object.keys(months).length,
        synced_at: syncedAt,
      },
      { onConflict: "report_type" }
    );

    return NextResponse.json({ data: months, synced_at: syncedAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync billing data" },
      { status: 500 }
    );
  }
}
