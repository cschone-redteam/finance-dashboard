import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchProfitAndLossMonthly,
  parseMonthlyPnLReport,
  fetchBalanceSheet,
  parseBalanceSheetReport,
  type MonthlyPnLEntry,
} from "@/lib/qbo";
import { fetchChargebeeMonthlyBillings } from "@/lib/chargebee";

const FLEX_REALM = "1223699155";
const PRODUCTS = ["Flex", "Go", "FieldLens", "TeamPlayer"] as const;
type Product = (typeof PRODUCTS)[number];

function classifyProduct(name: string): Product | null {
  const n = name.toLowerCase();
  if (n.includes("teamplayer") || n.includes("team player")) return "TeamPlayer";
  if (n.includes("fieldlens") || n.includes("field lens")) return "FieldLens";
  if (n.includes("paskr") || (n.includes("go") && !n.includes("category"))) return "Go";
  if (n.includes("flex") || n.includes("redteam") || n.includes("license") || n.includes("pro service"))
    return "Flex";
  return null;
}

function emptyProducts(): Record<Product, number> {
  return { Flex: 0, Go: 0, FieldLens: 0, TeamPlayer: 0 };
}

function extractRevenueByProduct(
  entries: MonthlyPnLEntry[],
): Record<string, Record<Product, number>> {
  const byMonth: Record<string, Record<Product, number>> = {};
  for (const entry of entries) {
    if (!entry.section.toLowerCase().includes("income")) continue;
    const product = classifyProduct(entry.accountName);
    if (!product) continue;
    for (const [month, amount] of Object.entries(entry.monthly)) {
      if (!byMonth[month]) byMonth[month] = emptyProducts();
      byMonth[month][product] += amount;
    }
  }
  return byMonth;
}

type BookingRow = Record<string, string | null>;

function extractBillingsByProduct(
  rows: BookingRow[],
): Record<string, Record<Product, number>> {
  const byMonth: Record<string, Record<Product, number>> = {};
  for (const row of rows) {
    const closedate = row.closedate;
    if (!closedate) continue;
    const d = new Date(closedate);
    if (isNaN(d.getTime())) continue;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amount = parseFloat(row.amount || row.tcv || "0") || 0;
    if (amount === 0) continue;

    const productOwned = row.product_owned || "";
    let product: Product = "Flex";
    const po = productOwned.toLowerCase();
    if (po.includes("teamplayer") || po.includes("team player")) product = "TeamPlayer";
    else if (po.includes("fieldlens") || po.includes("field lens")) product = "FieldLens";
    else if (po.includes("go") || po.includes("paskr")) product = "Go";

    if (!byMonth[month]) byMonth[month] = emptyProducts();
    byMonth[month][product] += amount;
  }
  return byMonth;
}

function findDeferredRevenue(
  sections: { section: string; accounts: { name: string; amount: number }[]; total: number }[],
): number | null {
  for (const s of sections) {
    for (const a of s.accounts) {
      if (a.name.toLowerCase().includes("deferred revenue")) return a.amount;
    }
    if (s.section.toLowerCase().includes("deferred revenue")) return s.total;
  }
  return null;
}

export type WaterfallMonth = {
  billings: Record<Product, number> & { total: number };
  revenue: Record<Product, number> & { total: number };
  beginningDR: number;
  endingDR: number;
};

export type WaterfallData = {
  months: Record<string, WaterfallMonth>;
  monthKeys: string[];
  qboBalance: number | null;
  sources: string[];
};

export async function GET() {
  const { data } = await supabaseAdmin
    .from("hubspot_report_cache")
    .select("rows, synced_at")
    .eq("report_type", "deferred-revenue")
    .single();

  if (!data) return NextResponse.json({ waterfall: null, synced_at: null });
  return NextResponse.json({ waterfall: data.rows, synced_at: data.synced_at });
}

export async function POST() {
  const year = new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const now = new Date();
  const endDate = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const sources: string[] = [];

  let revenueByMonth: Record<string, Record<Product, number>> = {};
  let qboBalance: number | null = null;

  try {
    const pnlReport = await fetchProfitAndLossMonthly(FLEX_REALM, startDate, endDate);
    const entries = parseMonthlyPnLReport(pnlReport);
    revenueByMonth = extractRevenueByProduct(entries);
    sources.push("qbo-pnl");

    const bs = await fetchBalanceSheet(FLEX_REALM, startDate, endDate);
    const bsSections = parseBalanceSheetReport(bs);
    qboBalance = findDeferredRevenue(bsSections);
    if (qboBalance !== null) sources.push("qbo-bs");
  } catch (err) {
    console.error("QBO error:", err);
  }

  let billingsByMonth: Record<string, Record<Product, number>> = {};
  try {
    const { data } = await supabaseAdmin
      .from("hubspot_report_cache")
      .select("rows")
      .eq("report_type", "bookings")
      .single();
    if (data?.rows) {
      billingsByMonth = extractBillingsByProduct(data.rows as BookingRow[]);
      sources.push("hubspot");
    }
  } catch (err) {
    console.error("HubSpot bookings cache error:", err);
  }

  let chargebeeBillings: Record<string, number> = {};
  try {
    chargebeeBillings = await fetchChargebeeMonthlyBillings(year);
    sources.push("chargebee");
  } catch (err) {
    console.error("Chargebee error:", err);
  }

  const allMonthKeys = new Set<string>();
  for (const m of Object.keys(revenueByMonth)) allMonthKeys.add(m);
  for (const m of Object.keys(billingsByMonth)) allMonthKeys.add(m);
  for (const m of Object.keys(chargebeeBillings)) allMonthKeys.add(m);
  const monthKeys = [...allMonthKeys].sort();

  const months: Record<string, WaterfallMonth> = {};
  let prevEnding = 0;

  for (const month of monthKeys) {
    const rev = revenueByMonth[month] || emptyProducts();
    const hsBillings = billingsByMonth[month] || emptyProducts();
    const cbFlex = chargebeeBillings[month] || 0;

    const billings = {
      Flex: cbFlex || hsBillings.Flex,
      Go: hsBillings.Go,
      FieldLens: hsBillings.FieldLens,
      TeamPlayer: hsBillings.TeamPlayer,
      total: 0,
    };
    billings.total = billings.Flex + billings.Go + billings.FieldLens + billings.TeamPlayer;

    const revenue = {
      ...rev,
      total: rev.Flex + rev.Go + rev.FieldLens + rev.TeamPlayer,
    };

    const beginningDR = prevEnding;
    const endingDR = beginningDR + billings.total - revenue.total;

    months[month] = { billings, revenue, beginningDR, endingDR };
    prevEnding = endingDR;
  }

  const waterfall: WaterfallData = { months, monthKeys, qboBalance, sources };

  await supabaseAdmin
    .from("hubspot_report_cache")
    .upsert(
      {
        report_type: "deferred-revenue",
        rows: waterfall as unknown as Record<string, string | null>[],
        row_count: monthKeys.length,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "report_type" },
    );

  return NextResponse.json({ waterfall, synced_at: new Date().toISOString() });
}
