import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const reportType = req.nextUrl.searchParams.get("type");
  if (!reportType) {
    return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hubspot_report_cache")
    .select("*")
    .eq("report_type", reportType)
    .single();

  if (error) {
    return NextResponse.json({ rows: [], synced_at: null, row_count: 0 });
  }

  return NextResponse.json({
    rows: data.rows,
    synced_at: data.synced_at,
    row_count: data.row_count,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { reportType, rows } = body;

  if (!reportType || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: "Missing reportType or rows" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("hubspot_report_cache")
    .upsert(
      {
        report_type: reportType,
        rows,
        row_count: rows.length,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "report_type" }
    );

  if (error) {
    console.error("Failed to upsert hubspot report cache:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rowCount: rows.length });
}
