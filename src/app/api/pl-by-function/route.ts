import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  fetchClasses,
  fetchProfitAndLossMonthly,
  getConnectedRealm,
  parseMonthlyPnLReport,
} from "@/lib/qbo";
import {
  CLASS_TO_FUNCTION,
  REVENUE_CLASS_MAP,
  emptyPL,
  type PLByFunctionData,
  type PLFunction,
  type RevenueProduct,
} from "@/lib/gl-mapping";

const YEAR = 2026;
const ACTUALS_START = `${YEAR}-01-01`;
const ACTUALS_END = `${YEAR}-07-31`;
const MONTH_KEYS = Array.from({ length: 12 }, (_, i) =>
  `${YEAR}-${String(i + 1).padStart(2, "0")}`
);
const ACTUAL_MONTHS = 7;

function monthIdx(key: string): number {
  const m = parseInt(key.split("-")[1], 10);
  return m - 1;
}

// Seed data used as fallback when QBO hasn't been synced
function seedData(): PLByFunctionData {
  return {
    revenue: {
      Flex: [424493.46,429568.99,419536.04,392620.35,398557.98,391783.23,408041.87,0,0,0,0,0],
      Go: [245930.81,231801.60,245158.66,213942.67,250278.34,242526.88,256153.77,0,0,0,0,0],
      Fieldlens: [22482.17,20734.67,25188.13,18960.48,22069.85,21221.40,30276.09,0,0,0,0,0],
      Other: [16249.75,9663.25,10234.75,11522.75,10365.50,10719.50,8800.00,0,0,0,0,0],
      Discounts: [-58441.89,-52322.74,-49847.64,-40428.02,-47751.23,-44431.25,-50158.54,0,0,0,0,0],
    },
    cogs: {
      CX: [132493.29,126319.64,121730.03,110868.33,106310.06,102252.21,185449.72,0,0,0,0,0],
      Infrastructure: [94111.50,89603.82,96374.20,102462.92,83523.00,92606.96,77298.66,0,0,0,0,0],
    },
    opex: {
      "G&A": [185209.42,187213.40,155345.17,139392.02,180987.42,82325.26,235608.35,0,0,0,0,0],
      Sales: [127569.87,121749.59,116367.80,129874.25,123684.94,148094.97,121028.16,0,0,0,0,0],
      Marketing: [118410.45,128549.13,185936.89,137845.86,110056.59,92373.05,108950.50,0,0,0,0,0],
      "R&D": [369925.10,335777.29,355850.49,357671.22,328508.21,292159.23,265965.58,0,0,0,0,0],
    },
    other: {
      interest: [1782.05,3600.63,3434.36,2713.69,1792.08,1552.44,2244.86,0,0,0,0,0],
      amortization: [141016.25,141016.25,141016.25,141016.25,141016.25,141016.25,141016.25,0,0,0,0,0],
      depreciation: [1185.99,1185.99,1185.99,1185.99,1215.57,1269.89,1269.89,0,0,0,0,0],
      tax: [0,0,0,2200,0,0,0,0,0,0,0,0],
    },
  };
}

function applyForecast(data: PLByFunctionData) {
  const allArrays = [
    ...Object.values(data.revenue),
    ...Object.values(data.cogs),
    ...Object.values(data.opex),
    data.other.interest,
    data.other.depreciation,
  ];

  for (const arr of allArrays) {
    const n = ACTUAL_MONTHS;
    const vals = arr.slice(0, n);
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    let slope = 0;
    let denom = 0;
    for (let i = 0; i < n; i++) {
      const mid = (n - 1) / 2;
      slope += (i - mid) * (vals[i] - mean);
      denom += (i - mid) ** 2;
    }
    slope = denom !== 0 ? slope / denom : 0;
    for (let m = n; m < 12; m++) {
      arr[m] = Math.round((mean + slope * (m - (n - 1) / 2)) * 100) / 100;
    }
  }

  for (let m = ACTUAL_MONTHS; m < 12; m++) {
    data.other.amortization[m] = 141016.25;
    data.other.tax[m] = 0;
  }
}

export async function GET(request: NextRequest) {
  const realmId = request.nextUrl.searchParams.get("realmId");

  try {
    const { data: allCached } = await supabaseAdmin
      .from("pl_function_cache")
      .select("*")
      .order("synced_at", { ascending: false });

    const target = realmId
      ? allCached?.find((c) => c.realm_id === realmId)
      : allCached?.[0];

    if (target) {
      return NextResponse.json({
        ...target.data as PLByFunctionData,
        synced_at: target.synced_at,
        source: "qbo",
      });
    }
  } catch {
    // Cache miss or table doesn't exist yet — fall through to seed data
  }

  const data = seedData();
  applyForecast(data);
  return NextResponse.json({ ...data, synced_at: null, source: "seed" });
}

export async function POST(request: NextRequest) {
  const { realmId: requestedRealm } = await request.json();
  const realmId = requestedRealm || (await getConnectedRealm());
  if (!realmId) {
    return NextResponse.json({ error: "QuickBooks not connected" }, { status: 401 });
  }

  try {
    const classes = await fetchClasses(realmId);
    const classNameToId = new Map<string, string>();
    for (const c of classes) {
      classNameToId.set(c.Name, c.Id);
      classNameToId.set(c.FullyQualifiedName, c.Id);
    }

    const pl = emptyPL();

    // --- Revenue classes ---
    const revenueClassNames = Object.keys(REVENUE_CLASS_MAP);
    for (const className of revenueClassNames) {
      const classId = classNameToId.get(className);
      if (!classId) continue;

      const product = REVENUE_CLASS_MAP[className];
      const report = await fetchProfitAndLossMonthly(realmId, ACTUALS_START, ACTUALS_END, classId);
      const entries = parseMonthlyPnLReport(report);

      for (const entry of entries) {
        const sec = entry.section.toLowerCase();
        if (sec === "sales" || sec.includes("income") || sec.includes("revenue")) {
          for (const [mk, amount] of Object.entries(entry.monthly)) {
            const mi = monthIdx(mk);
            if (mi >= 0 && mi < ACTUAL_MONTHS) {
              pl.revenue[product][mi] += amount;
            }
          }
        }
      }
    }

    // Revenue fallback: check for revenue not captured by class mapping
    // Fetch unfiltered P&L to get total revenue, then compare
    const unfilteredReport = await fetchProfitAndLossMonthly(realmId, ACTUALS_START, ACTUALS_END);
    const unfilteredEntries = parseMonthlyPnLReport(unfilteredReport);

    for (const entry of unfilteredEntries) {
      // Extract "Other" items (interest, amortization, depreciation, tax)
      const lower = entry.accountName.toLowerCase();
      if (lower.includes("interest")) {
        for (const [mk, amount] of Object.entries(entry.monthly)) {
          const mi = monthIdx(mk);
          if (mi >= 0 && mi < ACTUAL_MONTHS) pl.other.interest[mi] += amount;
        }
      } else if (lower.includes("amortization")) {
        for (const [mk, amount] of Object.entries(entry.monthly)) {
          const mi = monthIdx(mk);
          if (mi >= 0 && mi < ACTUAL_MONTHS) pl.other.amortization[mi] += amount;
        }
      } else if (lower.includes("depreciation")) {
        for (const [mk, amount] of Object.entries(entry.monthly)) {
          const mi = monthIdx(mk);
          if (mi >= 0 && mi < ACTUAL_MONTHS) pl.other.depreciation[mi] += amount;
        }
      } else if (lower.includes("tax") && entry.section.toLowerCase().includes("other")) {
        for (const [mk, amount] of Object.entries(entry.monthly)) {
          const mi = monthIdx(mk);
          if (mi >= 0 && mi < ACTUAL_MONTHS) pl.other.tax[mi] += amount;
        }
      }

    }

    // --- Expense classes ---
    const expenseClassNames = Object.keys(CLASS_TO_FUNCTION);
    for (const className of expenseClassNames) {
      const classId = classNameToId.get(className);
      if (!classId) continue;

      const fn: PLFunction = CLASS_TO_FUNCTION[className];
      const report = await fetchProfitAndLossMonthly(realmId, ACTUALS_START, ACTUALS_END, classId);
      const entries = parseMonthlyPnLReport(report);

      for (const entry of entries) {
        const section = entry.section.toLowerCase();
        if (section === "sales" || section.includes("income") || section.includes("revenue")) continue;
        if (entry.accountName.toLowerCase().includes("interest")) continue;
        if (entry.accountName.toLowerCase().includes("amortization")) continue;
        if (entry.accountName.toLowerCase().includes("depreciation")) continue;

        for (const [mk, amount] of Object.entries(entry.monthly)) {
          const mi = monthIdx(mk);
          if (mi < 0 || mi >= ACTUAL_MONTHS) continue;

          // ALL spending for a class goes to its function regardless of COGS/OpEx tagging
          if (fn === "CX" || fn === "Infrastructure") {
            pl.cogs[fn as "CX" | "Infrastructure"][mi] += amount;
          } else {
            pl.opex[fn as "G&A" | "Sales" | "Marketing" | "R&D"][mi] += amount;
          }
        }
      }
    }

    applyForecast(pl);

    await supabaseAdmin.from("pl_function_cache").upsert(
      { realm_id: realmId, data: pl, synced_at: new Date().toISOString() },
      { onConflict: "realm_id" }
    );

    return NextResponse.json({ ...pl, synced_at: new Date().toISOString(), source: "qbo" });
  } catch (err) {
    console.error("P&L by Function sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
