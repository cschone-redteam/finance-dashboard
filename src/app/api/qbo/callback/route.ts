import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/qbo";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/trial-balance?error=${error}`, request.url)
    );
  }

  if (!code || !realmId) {
    return NextResponse.redirect(
      new URL("/trial-balance?error=missing_params", request.url)
    );
  }

  try {
    await exchangeCodeForTokens(code, realmId);
    return NextResponse.redirect(
      new URL("/trial-balance?connected=true", request.url)
    );
  } catch (err) {
    console.error("QBO OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/trial-balance?error=token_exchange_failed", request.url)
    );
  }
}
