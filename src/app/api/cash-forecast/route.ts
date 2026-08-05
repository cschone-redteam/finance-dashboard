import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchCashForecastData,
  getConnectedRealm,
  type CashForecastMonth,
} from "@/lib/qbo";

export async function GET(request: NextRequest) {
  const realmId = request.nextUrl.searchParams.get("realmId");

  try {
    const { data: allCached } = await supabaseAdmin
      .from("cash_forecast_cache")
      .select("*")
      .order("synced_at", { ascending: false });

    const target = realmId
      ? allCached?.find((c) => c.realm_id === realmId)
      : allCached?.[0];

    if (target) {
      return NextResponse.json({
        months: target.months as CashForecastMonth[],
        realmId: target.realm_id,
        synced_at: target.synced_at,
      });
    }

    return NextResponse.json({ months: [], synced_at: null });
  } catch (err) {
    console.warn("Cash forecast cache read failed:", err);
    return NextResponse.json({ months: [], synced_at: null });
  }
}

export async function POST(request: NextRequest) {
  const { realmId: requestedRealm } = await request.json();

  const realmId = requestedRealm || (await getConnectedRealm());
  if (!realmId) {
    return NextResponse.json(
      { error: "QuickBooks not connected" },
      { status: 401 }
    );
  }

  try {
    const months = await fetchCashForecastData(realmId, "2026-01-01", new Date().toISOString().slice(0, 10));

    const { error: upsertErr } = await supabaseAdmin
      .from("cash_forecast_cache")
      .upsert(
        {
          realm_id: realmId,
          months,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "realm_id" }
      );

    if (upsertErr) {
      console.error("Cash forecast cache upsert error:", upsertErr);
    }

    return NextResponse.json({ months, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error("Cash forecast sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync cash forecast" },
      { status: 500 }
    );
  }
}
