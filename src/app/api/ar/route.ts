import { NextRequest, NextResponse } from "next/server";
import {
  fetchAgedReceivables,
  parseAgedReceivablesReport,
  getConnectedRealm,
} from "@/lib/qbo";

export async function GET(request: NextRequest) {
  const reportDate =
    request.nextUrl.searchParams.get("date") ||
    new Date().toISOString().slice(0, 10);

  const realmId =
    request.nextUrl.searchParams.get("realmId") ||
    (await getConnectedRealm());
  if (!realmId) {
    return NextResponse.json(
      { error: "QuickBooks not connected" },
      { status: 401 }
    );
  }

  try {
    const report = await fetchAgedReceivables(realmId, reportDate);
    const rows = parseAgedReceivablesReport(report);
    return NextResponse.json({ rows, reportDate });
  } catch (err) {
    console.error("AR Aging fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch AR aging" },
      { status: 500 }
    );
  }
}
