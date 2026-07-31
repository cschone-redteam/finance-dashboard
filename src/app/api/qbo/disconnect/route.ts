import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST() {
  await supabaseAdmin.from("qbo_tokens").delete().neq("id", "");
  return NextResponse.json({ disconnected: true });
}
