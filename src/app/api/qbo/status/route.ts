import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const { data: allRealms } = await supabaseAdmin
    .from("qbo_tokens")
    .select("realm_id, expires_at, created_at")
    .order("created_at");

  if (!allRealms || allRealms.length === 0) {
    return NextResponse.json({ connected: false });
  }

  const primary = allRealms[0];

  return NextResponse.json({
    connected: true,
    realm_id: primary.realm_id,
    expires_at: primary.expires_at,
    connected_at: primary.created_at,
    realms: allRealms.map((r) => ({
      realm_id: r.realm_id,
      connected_at: r.created_at,
    })),
  });
}
