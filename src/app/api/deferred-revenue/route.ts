import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchProfitAndLossMonthly,
  parseMonthlyPnLReport,
  fetchBalanceSheetMonthly,
  parseMonthlyDeferredRevenue,
  type MonthlyPnLEntry,
} from "@/lib/qbo";
import { fetchChargebeeMonthlyBillings } from "@/lib/chargebee";

const REDTEAM_REALM = "1223699155";
const PASKR_REALM = "791016560";
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
  productFilter?: Product[],
): Record<string, Record<Product, number>> {
  const byMonth: Record<string, Record<Product, number>> = {};
  for (const entry of entries) {
    if (!entry.section.toLowerCase().includes("income")) continue;
    const product = classifyProduct(entry.accountName);
    if (!product) continue;
    if (productFilter && !productFilter.includes(product)) continue;
    for (const [month, amount] of Object.entries(entry.monthly)) {
      if (!byMonth[month]) byMonth[month] = emptyProducts();
      byMonth[month][product] += amount;
    }
  }
  return byMonth;
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
  const bsStartDate = `${year - 1}-12-01`;
  const bsEndDate = endDate;
  const sources: string[] = [];

  let rtRevenueByMonth: Record<string, Record<Product, number>> = {};
  let goRevenueByMonth: Record<string, number> = {};
  let rtDrMonthly: Record<string, number> = {};
  let goDrMonthly: Record<string, number> = {};

  // Fetch P&L and Balance Sheet from both realms in parallel
  const [rtPnlResult, goPnlResult, rtBsResult, goBsResult, cbResult] = await Promise.allSettled([
    fetchProfitAndLossMonthly(REDTEAM_REALM, startDate, endDate),
    fetchProfitAndLossMonthly(PASKR_REALM, startDate, endDate),
    fetchBalanceSheetMonthly(REDTEAM_REALM, bsStartDate, bsEndDate),
    fetchBalanceSheetMonthly(PASKR_REALM, bsStartDate, bsEndDate),
    fetchChargebeeMonthlyBillings(year),
  ]);

  // RedTeam P&L → Flex, FieldLens, TeamPlayer revenue
  if (rtPnlResult.status === "fulfilled") {
    const entries = parseMonthlyPnLReport(rtPnlResult.value);
    rtRevenueByMonth = extractRevenueByProduct(entries, ["Flex", "FieldLens", "TeamPlayer"]);
    sources.push("qbo-pnl-redteam");
  } else {
    console.error("RedTeam P&L error:", rtPnlResult.reason);
  }

  // PASKR P&L → Go revenue (all income = Go)
  if (goPnlResult.status === "fulfilled") {
    const entries = parseMonthlyPnLReport(goPnlResult.value);
    for (const entry of entries) {
      if (!entry.section.toLowerCase().includes("income")) continue;
      for (const [month, amount] of Object.entries(entry.monthly)) {
        goRevenueByMonth[month] = (goRevenueByMonth[month] || 0) + amount;
      }
    }
    sources.push("qbo-pnl-paskr");
  } else {
    console.error("PASKR P&L error:", goPnlResult.reason);
  }

  // RedTeam Balance Sheet → monthly DR balances
  if (rtBsResult.status === "fulfilled") {
    rtDrMonthly = parseMonthlyDeferredRevenue(rtBsResult.value);
    sources.push("qbo-bs-redteam");
  } else {
    console.error("RedTeam BS error:", rtBsResult.reason);
  }

  // PASKR Balance Sheet → monthly DR balances
  if (goBsResult.status === "fulfilled") {
    goDrMonthly = parseMonthlyDeferredRevenue(goBsResult.value);
    sources.push("qbo-bs-paskr");
  } else {
    console.error("PASKR BS error:", goBsResult.reason);
  }

  // Chargebee → Flex billing detail
  let chargebeeBillings: Record<string, number> = {};
  if (cbResult.status === "fulfilled") {
    chargebeeBillings = cbResult.value;
    sources.push("chargebee");
  } else {
    console.error("Chargebee error:", cbResult.reason);
  }

  // Generate all 12 month keys
  const monthKeys: string[] = [];
  for (let m = 1; m <= 12; m++) {
    monthKeys.push(`${year}-${String(m).padStart(2, "0")}`);
  }

  const decPriorKey = `${year - 1}-12`;
  const months: Record<string, WaterfallMonth> = {};

  // Compute the latest QBO DR balance for the summary card
  let qboBalance: number | null = null;

  for (let mi = 0; mi < monthKeys.length; mi++) {
    const month = monthKeys[mi];

    // Per-realm DR balances
    const prevKey = mi === 0 ? decPriorKey : monthKeys[mi - 1];
    const rtDrBegin = rtDrMonthly[prevKey] ?? 0;
    const goDrBegin = goDrMonthly[prevKey] ?? 0;
    const rtDrEnd = rtDrMonthly[month] ?? rtDrBegin;
    const goDrEnd = goDrMonthly[month] ?? goDrBegin;

    // Revenue from each realm
    const rtRev = rtRevenueByMonth[month] || emptyProducts();
    const goRev = goRevenueByMonth[month] || 0;

    // Total RedTeam realm billings derived from BS change + revenue
    const rtTotalRevenue = rtRev.Flex + rtRev.FieldLens + rtRev.TeamPlayer;
    const rtTotalBillings = (rtDrEnd - rtDrBegin) + rtTotalRevenue;

    // Go billings from PASKR BS change + revenue
    const goBillings = (goDrEnd - goDrBegin) + goRev;

    // Flex billings from Chargebee; remaining RedTeam billings go to FieldLens + TeamPlayer
    const flexBillings = chargebeeBillings[month] || 0;
    const remainingBillings = rtTotalBillings - flexBillings;

    const flRev = rtRev.FieldLens;
    const tpRev = rtRev.TeamPlayer;
    const flTpTotal = flRev + tpRev;
    const flBillings = flTpTotal > 0
      ? remainingBillings * (flRev / flTpTotal)
      : remainingBillings / 2;
    const tpBillings = remainingBillings - flBillings;

    const billings = {
      Flex: flexBillings,
      Go: goBillings,
      FieldLens: flBillings,
      TeamPlayer: tpBillings,
      total: flexBillings + goBillings + flBillings + tpBillings,
    };

    const revenue = {
      Flex: rtRev.Flex,
      Go: goRev,
      FieldLens: flRev,
      TeamPlayer: tpRev,
      total: rtRev.Flex + goRev + flRev + tpRev,
    };

    const beginningDR = rtDrBegin + goDrBegin;
    const endingDR = rtDrEnd + goDrEnd;

    // Track latest month with actual QBO data
    if (rtDrMonthly[month] !== undefined || goDrMonthly[month] !== undefined) {
      qboBalance = endingDR;
    }

    months[month] = { billings, revenue, beginningDR, endingDR };
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
