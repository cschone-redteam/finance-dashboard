import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { PandaDocContract } from "@/lib/pandadoc";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contracts: PandaDocContract[] = body.contracts;

    if (!Array.isArray(contracts) || contracts.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'contracts' array" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("hubspot_report_cache")
      .upsert(
        {
          report_type: "pandadoc-contracts",
          rows: contracts,
          row_count: contracts.length,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "report_type" },
      );

    if (error) {
      return NextResponse.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      count: contracts.length,
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
