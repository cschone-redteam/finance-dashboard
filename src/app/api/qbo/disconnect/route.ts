import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const realmId = body.realmId;

  if (realmId) {
    await supabaseAdmin.from("qbo_tokens").delete().eq("realm_id", realmId);
  } else {
    await supabaseAdmin.from("qbo_tokens").delete().neq("id", "");
  }

  return NextResponse.json({ disconnected: true });
}
