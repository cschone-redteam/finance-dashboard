import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("qbo_tokens")
    .select("realm_id, expires_at, created_at")
    .limit(1)
    .single();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    realm_id: data.realm_id,
    expires_at: data.expires_at,
    connected_at: data.created_at,
  });
}
