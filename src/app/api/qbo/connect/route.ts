import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/qbo";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
