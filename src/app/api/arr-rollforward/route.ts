import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

type Row = Record<string, string | null>;

function monthIndex(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d.getFullYear() !== 2026) return null;
  return d.getMonth(); // 0=Jan, 11=Dec
}

function toNum(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[,$]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function GET() {
  try {
    const [bookingsRes, churnRes, renewalsRes] = await Promise.all([
      supabaseAdmin
        .from("hubspot_report_cache")
        .select("rows")
        .eq("report_type", "bookings")
        .single(),
      supabaseAdmin
        .from("hubspot_report_cache")
        .select("rows")
        .eq("report_type", "churn")
        .single(),
      supabaseAdmin
        .from("hubspot_report_cache")
        .select("rows")
        .eq("report_type", "renewals")
        .single(),
    ]);

    const newArr = new Array(12).fill(0);
    const churnArr = new Array(12).fill(0);
    const expansionArr = new Array(12).fill(0);
    const downsellArr = new Array(12).fill(0);

    // Bookings (closed-won from sales pipeline) → New
    const bookings: Row[] = bookingsRes.data?.rows || [];
    for (const deal of bookings) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const arr = toNum(deal.arr) || toNum(deal.amount);
      newArr[mi] += arr;
    }

    // Churn deals → Churn
    const churns: Row[] = churnRes.data?.rows || [];
    for (const deal of churns) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const lost = toNum(deal.expiring_arr);
      churnArr[mi] += lost;
    }

    // Renewals → Expansion or Downsell based on ARR change
    const renewals: Row[] = renewalsRes.data?.rows || [];
    for (const deal of renewals) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const newVal = toNum(deal.arr);
      const oldVal = toNum(deal.expiring_arr);
      if (newVal === 0 && oldVal === 0) continue;
      const diff = newVal - oldVal;
      if (diff > 0) {
        expansionArr[mi] += diff;
      } else if (diff < 0) {
        downsellArr[mi] += Math.abs(diff);
      }
    }

    return NextResponse.json({
      new: newArr,
      churn: churnArr,
      expansion: expansionArr,
      downsell: downsellArr,
    });
  } catch (err) {
    console.error("ARR Rollforward API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute rollforward" },
      { status: 500 },
    );
  }
}
