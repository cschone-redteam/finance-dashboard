import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchAgedReceivables,
  parseAgedReceivablesReport,
  fetchCustomerCount,
  getConnectedRealm,
} from "@/lib/qbo";

export async function GET(request: NextRequest) {
  const realmId = request.nextUrl.searchParams.get("realmId");

  try {
    const { data: allCached } = await supabaseAdmin
      .from("ar_aging_cache")
      .select("*")
      .order("synced_at", { ascending: false });

    const cachedRealms = (allCached || []).map((c) => ({
      realm_id: c.realm_id,
      realm_label: c.realm_label,
      synced_at: c.synced_at,
      total_customers: c.total_customers ?? null,
    }));

    const target = realmId
      ? allCached?.find((c) => c.realm_id === realmId)
      : allCached?.[0];

    if (target) {
      return NextResponse.json({
        rows: target.rows,
        reportDate: target.report_date,
        realmId: target.realm_id,
        realmLabel: target.realm_label,
        synced_at: target.synced_at,
        totalCustomers: target.total_customers ?? null,
        cachedRealms,
      });
    }

    return NextResponse.json({ rows: [], reportDate: null, synced_at: null, cachedRealms });
  } catch (err) {
    console.warn("AR cache read failed:", err);
    return NextResponse.json({ rows: [], reportDate: null, synced_at: null });
  }
}

export async function POST(request: NextRequest) {
  const { realmId: requestedRealm, realmLabel } = await request.json();

  const realmId = requestedRealm || (await getConnectedRealm());
  if (!realmId) {
    return NextResponse.json(
      { error: "QuickBooks not connected" },
      { status: 401 }
    );
  }

  const reportDate = new Date().toISOString().slice(0, 10);

  try {
    const [report, totalCustomers] = await Promise.all([
      fetchAgedReceivables(realmId, reportDate),
      fetchCustomerCount(realmId),
    ]);
    const rows = parseAgedReceivablesReport(report);

    const { error: upsertErr } = await supabaseAdmin
      .from("ar_aging_cache")
      .upsert(
        {
          realm_id: realmId,
          realm_label: realmLabel || null,
          report_date: reportDate,
          rows,
          total_customers: totalCustomers,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "realm_id" }
      );

    if (upsertErr) {
      console.error("AR cache upsert error:", upsertErr);
    }

    return NextResponse.json({ rows, reportDate, totalCustomers, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error("AR Aging sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync AR aging" },
      { status: 500 }
    );
  }
}
