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

function parseProducts(productOwned: string | null | undefined): Product[] {
  if (!productOwned) return ["Flex"];
  const parts = productOwned.toLowerCase().trim().split(/\s*\+\s*/);
  const products: Product[] = [];
  for (const part of parts) {
    const t = part.trim();
    if (t === "rtflex" || t === "flex") products.push("Flex");
    else if (t === "rtgo" || t === "go") products.push("Go");
    else if (t === "fl" || t === "fieldlens") products.push("FieldLens");
    else if (t === "tp" || t === "teamplayer") products.push("TeamPlayer");
  }
  return products.length > 0 ? products : ["Flex"];
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
      const products = parseProducts(deal.product_owned);
      const share = arr / products.length;
      newTotal[mi] += arr;
      for (const product of products) newByProduct[product][mi] += share;
    }

    const churns: Row[] = churnRes.data?.rows || [];
    for (const deal of churns) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const lost = toNum(deal.expiring_arr);
      const products = parseProducts(deal.product_owned);
      const share = lost / products.length;
      churnTotal[mi] += lost;
      for (const product of products) churnByProduct[product][mi] += share;
    }

    const renewals: Row[] = renewalsRes.data?.rows || [];
    for (const deal of renewals) {
      const mi = monthIndex(deal.closedate);
      if (mi === null) continue;
      const newVal = toNum(deal.arr);
      const oldVal = toNum(deal.expiring_arr);
      if (newVal === 0 && oldVal === 0) continue;
      const diff = newVal - oldVal;
      const products = parseProducts(deal.product_owned);
      const share = Math.abs(diff) / products.length;
      if (diff > 0) {
        expansionTotal[mi] += diff;
        for (const product of products) expansionByProduct[product][mi] += share;
      } else if (diff < 0) {
        downsellTotal[mi] += Math.abs(diff);
        for (const product of products) downsellByProduct[product][mi] += share;
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
