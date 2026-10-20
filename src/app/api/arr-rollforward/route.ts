import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

type Row = Record<string, string | null>;

const PRODUCTS = ["Flex", "Go", "FieldLens", "TeamPlayer"] as const;
type Product = (typeof PRODUCTS)[number];

function monthIndex(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d.getFullYear() !== 2026) return null;
  return d.getMonth();
}

function toNum(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[,$]/g, ""));
  return isNaN(n) ? 0 : n;
}

function classifyProduct(productOwned: string | null | undefined): Product {
  if (!productOwned) return "Flex";
  const p = productOwned.toLowerCase().trim();
  if (p.includes("fieldlens") || p.includes("field lens")) return "FieldLens";
  if (p.includes("teamplayer") || p.includes("team player")) return "TeamPlayer";
  if (p === "go" || p.includes("paskr") || p.includes("redteam go")) return "Go";
  return "Flex";
}

function emptyProductArrays(): Record<Product, number[]> {
  return {
    Flex: new Array(12).fill(0),
    Go: new Array(12).fill(0),
    FieldLens: new Array(12).fill(0),
    TeamPlayer: new Array(12).fill(0),
  };
}

export type CategoryData = {
  total: number[];
  byProduct: Record<Product, number[]>;
};

export type RollforwardResponse = {
  new: CategoryData;
  churn: CategoryData;
  expansion: CategoryData;
  downsell: CategoryData;
};

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

    const newTotal = new Array(12).fill(0);
    const newByProduct = emptyProductArrays();
    const churnTotal = new Array(12).fill(0);
    const churnByProduct = emptyProductArrays();
    const expansionTotal = new Array(12).fill(0);
    const expansionByProduct = emptyProductArrays();
    const downsellTotal = new Array(12).fill(0);
    const downsellByProduct = emptyProductArrays();

    const bookings: Row[] = bookingsRes.data?.rows || [];
    for (const deal of bookings) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const arr = toNum(deal.arr) || toNum(deal.amount);
      const product = classifyProduct(deal.product_owned);
      newTotal[mi] += arr;
      newByProduct[product][mi] += arr;
    }

    const churns: Row[] = churnRes.data?.rows || [];
    for (const deal of churns) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const lost = toNum(deal.expiring_arr);
      const product = classifyProduct(deal.product_owned);
      churnTotal[mi] += lost;
      churnByProduct[product][mi] += lost;
    }

    const renewals: Row[] = renewalsRes.data?.rows || [];
    for (const deal of renewals) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const newVal = toNum(deal.arr);
      const oldVal = toNum(deal.expiring_arr);
      if (newVal === 0 && oldVal === 0) continue;
      const diff = newVal - oldVal;
      const product = classifyProduct(deal.product_owned);
      if (diff > 0) {
        expansionTotal[mi] += diff;
        expansionByProduct[product][mi] += diff;
      } else if (diff < 0) {
        downsellTotal[mi] += Math.abs(diff);
        downsellByProduct[product][mi] += Math.abs(diff);
      }
    }

    const response: RollforwardResponse = {
      new: { total: newTotal, byProduct: newByProduct },
      churn: { total: churnTotal, byProduct: churnByProduct },
      expansion: { total: expansionTotal, byProduct: expansionByProduct },
      downsell: { total: downsellTotal, byProduct: downsellByProduct },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("ARR Rollforward API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute rollforward" },
      { status: 500 },
    );
  }
}
