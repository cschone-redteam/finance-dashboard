import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchAgedReceivables,
  parseAgedReceivablesReport,
  getConnectedRealm,
} from "@/lib/qbo";

export async function GET(request: NextRequest) {
  const realmId = request.nextUrl.searchParams.get("realmId");

  try {
    if (realmId) {
      const { data } = await supabaseAdmin
        .from("ar_aging_cache")
        .select("*")
        .eq("realm_id", realmId)
        .single();

      if (data) {
        return NextResponse.json({
          rows: data.rows,
          reportDate: data.report_date,
          realmId: data.realm_id,
          realmLabel: data.realm_label,
          synced_at: data.synced_at,
        });
      }
    }

    const { data: allCached } = await supabaseAdmin
      .from("ar_aging_cache")
      .select("*")
      .order("synced_at", { ascending: false });

    if (allCached && allCached.length > 0) {
      const target = realmId
        ? allCached.find((c) => c.realm_id === realmId) || allCached[0]
        : allCached[0];

      return NextResponse.json({
        rows: target.rows,
        reportDate: target.report_date,
        realmId: target.realm_id,
        realmLabel: target.realm_label,
        synced_at: target.synced_at,
        cachedRealms: allCached.map((c) => ({
          realm_id: c.realm_id,
          realm_label: c.realm_label,
          synced_at: c.synced_at,
        })),
      });
    }

    return NextResponse.json({ rows: [], reportDate: null, synced_at: null });
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
    const report = await fetchAgedReceivables(realmId, reportDate);
    const rows = parseAgedReceivablesReport(report);

    const { error: upsertErr } = await supabaseAdmin
      .from("ar_aging_cache")
      .upsert(
        {
          realm_id: realmId,
          realm_label: realmLabel || null,
          report_date: reportDate,
          rows,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "realm_id" }
      );

    if (upsertErr) {
      console.error("AR cache upsert error:", upsertErr);
    }

    return NextResponse.json({ rows, reportDate, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error("AR Aging sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync AR aging" },
      { status: 500 }
    );
  }
}
