"use client";

import { useCallback, useEffect, useState } from "react";

type DealMetrics = {
  quarter: string;
  new_business_arr: number;
  new_business_count: number;
  renewal_arr: number;
  renewal_count: number;
  expiring_arr: number;
  expansion_arr: number;
  expansion_count: number;
  churned_arr: number;
  churned_count: number;
  total_closed_arr: number;
  total_closed_count: number;
};

type PnLData = {
  quarter: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  sm_expenses: number;
  net_income: number;
  interest: number;
  taxes: number;
  depreciation_amortization: number;
  ebitda: number;
};

const RT_RED = "#EF373E";
const RT_BLUE = "#40A4EB";
const RT_DARK = "#141414";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtRatio(n: number): string {
  return `${n.toFixed(1)}x`;
}

function fmtMonths(n: number): string {
  return `${n.toFixed(0)} mo`;
}

type ViewMode = "monthly" | "quarterly" | "ytd" | "ttm";

function sumW(metrics: DealMetrics[], endIdx: number, field: keyof DealMetrics, w: number = 4): number {
  const start = Math.max(0, endIdx - w + 1);
  let total = 0;
  for (let i = start; i <= endIdx; i++) {
    if (metrics[i]) total += metrics[i][field] as number;
  }
  return total;
}

function sliceW(metrics: DealMetrics[], endIdx: number, w: number = 4): DealMetrics[] {
  const start = Math.max(0, endIdx - w + 1);
  return metrics.slice(start, endIdx + 1);
}

function calcNRR(metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  const expiring = sumW(metrics, endIdx, "expiring_arr", w);
  if (!expiring) return null;
  const renewed = sumW(metrics, endIdx, "renewal_arr", w);
  const expanded = sumW(metrics, endIdx, "expansion_arr", w);
  return ((renewed + expanded) / expiring) * 100;
}

function calcGRR(metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  const expiring = sumW(metrics, endIdx, "expiring_arr", w);
  if (!expiring) return null;
  const renewed = sumW(metrics, endIdx, "renewal_arr", w);
  return (renewed / expiring) * 100;
}

function calcGrossMargin(p: PnLData): number | null {
  if (!p.revenue) return null;
  return (p.gross_profit / p.revenue) * 100;
}

function calcWindowGrossMargin(pm: Map<string, PnLData>, metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  const slice = sliceW(metrics, endIdx, w);
  let totalRev = 0, totalGP = 0;
  for (const d of slice) {
    const pnl = pm.get(d.quarter);
    if (pnl) { totalRev += pnl.revenue; totalGP += pnl.gross_profit; }
  }
  if (!totalRev) return null;
  return (totalGP / totalRev) * 100;
}

function calcQuickRatio(metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  const churned = sumW(metrics, endIdx, "churned_arr", w);
  if (!churned) return null;
  const newBiz = sumW(metrics, endIdx, "new_business_arr", w);
  const expansion = sumW(metrics, endIdx, "expansion_arr", w);
  return (newBiz + expansion) / churned;
}

function calcACV(metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  const arr = sumW(metrics, endIdx, "new_business_arr", w);
  const count = sumW(metrics, endIdx, "new_business_count", w);
  if (!count) return null;
  return arr / count;
}

function calcCac(pm: Map<string, PnLData>, metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  const slice = sliceW(metrics, endIdx, w);
  let totalSpend = 0, totalDeals = 0;
  const allHaveSm = slice.every((d) => {
    const pnl = pm.get(d.quarter);
    return pnl && pnl.sm_expenses > 0;
  });
  for (const d of slice) {
    const pnl = pm.get(d.quarter);
    if (pnl) totalSpend += allHaveSm ? pnl.sm_expenses : pnl.operating_expenses;
    totalDeals += d.new_business_count;
  }
  if (!totalDeals || !totalSpend) return null;
  return totalSpend / totalDeals;
}

function calcCacPayback(pm: Map<string, PnLData>, metrics: DealMetrics[], endIdx: number, gm: number | null, w: number = 4): number | null {
  const cac = calcCac(pm, metrics, endIdx, w);
  if (!cac) return null;
  const arr = sumW(metrics, endIdx, "new_business_arr", w);
  const count = sumW(metrics, endIdx, "new_business_count", w);
  if (!count) return null;
  const monthlyArpu = (arr / count) / 12;
  const gmFrac = gm ? gm / 100 : 0.7;
  if (monthlyArpu * gmFrac === 0) return null;
  return cac / (monthlyArpu * gmFrac);
}

function calcLtvCac(pm: Map<string, PnLData>, metrics: DealMetrics[], endIdx: number, gm: number | null, w: number = 4): number | null {
  const cac = calcCac(pm, metrics, endIdx, w);
  if (!cac) return null;
  const newBizArr = sumW(metrics, endIdx, "new_business_arr", w);
  const newBizCount = sumW(metrics, endIdx, "new_business_count", w);
  const expiring = sumW(metrics, endIdx, "expiring_arr", w);
  const churned = sumW(metrics, endIdx, "churned_arr", w);
  if (!newBizCount || !expiring) return null;
  const arpu = newBizArr / newBizCount;
  const churnRate = churned / (expiring + newBizArr);
  if (churnRate === 0) return null;
  const gmFrac = gm ? gm / 100 : 0.7;
  const ltv = (arpu * gmFrac) / churnRate;
  return ltv / cac;
}

function calcRuleOf40(arrGrowth: number | null, ebitdaMargin: number | null): number | null {
  if (arrGrowth === null || ebitdaMargin === null) return null;
  return arrGrowth + ebitdaMargin;
}

function calcArrGrowth(metrics: DealMetrics[], endIdx: number, w: number = 4): number | null {
  if (endIdx < w) return null;
  const priorEnd = endIdx - w;
  if (priorEnd < 0) return null;
  const currentNet = sumW(metrics, endIdx, "new_business_arr", w) + sumW(metrics, endIdx, "renewal_arr", w) + sumW(metrics, endIdx, "expansion_arr", w) - sumW(metrics, endIdx, "churned_arr", w);
  const priorNet = sumW(metrics, priorEnd, "new_business_arr", w) + sumW(metrics, priorEnd, "renewal_arr", w) + sumW(metrics, priorEnd, "expansion_arr", w) - sumW(metrics, priorEnd, "churned_arr", w);
  if (priorNet === 0) return null;
  return ((currentNet - priorNet) / Math.abs(priorNet)) * 100;
}

function expandToMonthly(quarters: DealMetrics[]): DealMetrics[] {
  return quarters.flatMap((q) => {
    const [year, qStr] = q.quarter.split("-Q");
    const qNum = parseInt(qStr);
    return [0, 1, 2].map((m) => ({
      ...q,
      quarter: `${year}-${String((qNum - 1) * 3 + m + 1).padStart(2, "0")}`,
      new_business_arr: q.new_business_arr / 3,
      new_business_count: Math.round(q.new_business_count / 3),
      renewal_arr: q.renewal_arr / 3,
      renewal_count: Math.round(q.renewal_count / 3),
      expiring_arr: q.expiring_arr / 3,
      expansion_arr: q.expansion_arr / 3,
      expansion_count: Math.round(q.expansion_count / 3),
      churned_arr: q.churned_arr / 3,
      churned_count: Math.round(q.churned_count / 3),
      total_closed_arr: q.total_closed_arr / 3,
      total_closed_count: Math.round(q.total_closed_count / 3),
    }));
  });
}

function expandPnlToMonthly(pnlArr: PnLData[]): PnLData[] {
  return pnlArr.flatMap((p) => {
    const [year, qStr] = p.quarter.split("-Q");
    const qNum = parseInt(qStr);
    return [0, 1, 2].map((m) => ({
      ...p,
      quarter: `${year}-${String((qNum - 1) * 3 + m + 1).padStart(2, "0")}`,
      revenue: p.revenue / 3, cogs: p.cogs / 3, gross_profit: p.gross_profit / 3,
      operating_expenses: p.operating_expenses / 3, sm_expenses: p.sm_expenses / 3,
      net_income: p.net_income / 3, interest: p.interest / 3, taxes: p.taxes / 3,
      depreciation_amortization: p.depreciation_amortization / 3, ebitda: p.ebitda / 3,
    }));
  });
}

function aggregateMetrics(rows: DealMetrics[]): DealMetrics {
  const sum = (f: keyof DealMetrics) => rows.reduce((s, d) => s + (d[f] as number), 0);
  return { quarter: "", new_business_arr: sum("new_business_arr"), new_business_count: sum("new_business_count"), renewal_arr: sum("renewal_arr"), renewal_count: sum("renewal_count"), expiring_arr: sum("expiring_arr"), expansion_arr: sum("expansion_arr"), expansion_count: sum("expansion_count"), churned_arr: sum("churned_arr"), churned_count: sum("churned_count"), total_closed_arr: sum("total_closed_arr"), total_closed_count: sum("total_closed_count") };
}

function aggregatePnl(rows: PnLData[]): PnLData | null {
  if (!rows.length) return null;
  const sum = (f: keyof PnLData) => rows.reduce((s, p) => s + (p[f] as number), 0);
  return { quarter: "", revenue: sum("revenue"), cogs: sum("cogs"), gross_profit: sum("gross_profit"), operating_expenses: sum("operating_expenses"), sm_expenses: sum("sm_expenses"), net_income: sum("net_income"), interest: sum("interest"), taxes: sum("taxes"), depreciation_amortization: sum("depreciation_amortization"), ebitda: sum("ebitda") };
}

function formatPeriod(period: string): string {
  if (period.includes("-Q")) return period;
  const [year, month] = period.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(month) - 1]} '${year.slice(2)}`;
}

type Sentiment = "good" | "ok" | "bad" | "neutral";

function sentiment(value: number | null, thresholds: { good: number; ok: number }, higherBetter = true): Sentiment {
  if (value === null) return "neutral";
  if (higherBetter) {
    if (value >= thresholds.good) return "good";
    if (value >= thresholds.ok) return "ok";
    return "bad";
  }
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.ok) return "ok";
  return "bad";
}

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  ok: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-gray-400 dark:text-gray-500",
};

const SENTIMENT_BG: Record<Sentiment, string> = {
  good: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  ok: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  bad: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  neutral: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
};

const SENTIMENT_DOT: Record<Sentiment, string> = {
  good: "bg-emerald-500",
  ok: "bg-amber-500",
  bad: "bg-red-500",
  neutral: "bg-gray-400",
};

const SENTIMENT_GRADIENT: Record<Sentiment, string> = {
  good: "from-emerald-500 to-emerald-600",
  ok: "from-amber-400 to-amber-500",
  bad: "from-red-500 to-red-600",
  neutral: "from-gray-300 to-gray-400",
};

export default function ReportingPage() {
  const [dealMetrics, setDealMetrics] = useState<DealMetrics[]>([]);
  const [pnlData, setPnlData] = useState<PnLData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncingPnl, setSyncingPnl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("ttm");
  const [deckMode, setDeckMode] = useState(false);

  function exportForDeck() {
    document.body.classList.add("deck-mode");
    setDeckMode(true);
    setTimeout(() => {
      window.print();
      document.body.classList.remove("deck-mode");
      setDeckMode(false);
    }, 100);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metrics/data");
      const data = await res.json();
      setDealMetrics(data.dealMetrics || []);
      setPnlData(data.pnlData || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function seedDealMetrics() {
    setSeeding(true); setMessage(null);
    try {
      const res = await fetch("/api/metrics/seed", { method: "POST" });
      const data = await res.json();
      if (data.error) setMessage({ type: "error", text: data.error });
      else { setMessage({ type: "success", text: `Seeded ${data.seeded} quarters of HubSpot deal data` }); await loadData(); }
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Seed failed" }); }
    finally { setSeeding(false); }
  }

  async function syncPnl(quarter: string) {
    setSyncingPnl(quarter); setMessage(null);
    try {
      const res = await fetch("/api/qbo/pnl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quarter }) });
      const data = await res.json();
      if (data.error) setMessage({ type: "error", text: `${quarter}: ${data.error}` });
      else { setMessage({ type: "success", text: `Synced P&L for ${quarter}` }); await loadData(); }
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Sync failed" }); }
    finally { setSyncingPnl(null); }
  }

  async function syncAllPnl() {
    setSyncing(true); setMessage(null);
    const quarters = dealMetrics.map((d) => d.quarter);
    let success = 0;
    for (const q of quarters) {
      try {
        const res = await fetch("/api/qbo/pnl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quarter: q }) });
        const data = await res.json();
        if (!data.error) success++;
      } catch { /* continue */ }
    }
    setMessage({ type: "success", text: `Synced P&L for ${success}/${quarters.length} quarters` });
    await loadData(); setSyncing(false);
  }

  const pnlMap = new Map(pnlData.map((p) => [p.quarter, p]));
  const latestIdx = dealMetrics.length - 1;
  const latest = dealMetrics[latestIdx];

  // View-mode data
  const currentYear = latest?.quarter.split("-Q")[0] || "2026";
  const monthlyMetrics = expandToMonthly(dealMetrics);
  const monthlyPnlMap = new Map(expandPnlToMonthly(pnlData).map((p) => [p.quarter, p]));

  let vm: DealMetrics[], vp: Map<string, PnLData>, kpiW: number, periodLabel: string;
  switch (viewMode) {
    case "monthly":
      vm = monthlyMetrics; vp = monthlyPnlMap; kpiW = 12;
      periodLabel = vm.length > 0 ? formatPeriod(vm[vm.length - 1].quarter) : "";
      break;
    case "quarterly":
      vm = dealMetrics; vp = pnlMap; kpiW = 1;
      periodLabel = latest?.quarter || "";
      break;
    case "ytd": {
      vm = dealMetrics; vp = pnlMap;
      kpiW = dealMetrics.filter((d) => d.quarter.startsWith(currentYear)).length;
      periodLabel = `YTD ${currentYear}`;
      break;
    }
    default:
      vm = dealMetrics; vp = pnlMap; kpiW = 4;
      periodLabel = latest ? `TTM ending ${latest.quarter}` : "";
  }
  const vIdx = vm.length - 1;

  // KPI computation over the selected window
  const vNRR = vIdx >= 0 ? calcNRR(vm, vIdx, kpiW) : null;
  const vGRR = vIdx >= 0 ? calcGRR(vm, vIdx, kpiW) : null;
  const vGM = vIdx >= 0 ? calcWindowGrossMargin(vp, vm, vIdx, kpiW) : null;
  const vLtvCac = vIdx >= 0 ? calcLtvCac(vp, vm, vIdx, vGM, kpiW) : null;
  const vEbitdaMargin = (() => {
    if (vIdx < 0) return null;
    const slice = sliceW(vm, vIdx, kpiW);
    let totalRev = 0, totalEbitda = 0;
    for (const d of slice) { const p = vp.get(d.quarter); if (p) { totalRev += p.revenue; totalEbitda += p.ebitda; } }
    if (!totalRev) return null;
    return (totalEbitda / totalRev) * 100;
  })();
  const vQuickRatio = vIdx >= 0 ? calcQuickRatio(vm, vIdx, kpiW) : null;
  const vACV = vIdx >= 0 ? calcACV(vm, vIdx, kpiW) : null;
  const vCacPayback = vIdx >= 0 ? calcCacPayback(vp, vm, vIdx, vGM, kpiW) : null;
  const vArrGrowth = vIdx >= 0 ? calcArrGrowth(vm, vIdx, kpiW) : null;
  const vRuleOf40 = calcRuleOf40(vArrGrowth, vEbitdaMargin);

  // Waterfall and P&L for selected window
  const wfSlice = vIdx >= 0 ? sliceW(vm, vIdx, kpiW) : [];
  const waterfallData = wfSlice.length > 0 ? { ...aggregateMetrics(wfSlice), quarter: periodLabel } : null;
  const pnlSlice = wfSlice.map((d) => vp.get(d.quarter)).filter(Boolean) as PnLData[];
  const summaryPnl = pnlSlice.length > 0 ? { ...aggregatePnl(pnlSlice)!, quarter: periodLabel } : null;
  const latestARR = waterfallData ? waterfallData.new_business_arr + waterfallData.renewal_arr + waterfallData.expansion_arr - waterfallData.churned_arr : 0;

  // Trend rows based on view mode
  let trendRows: DealMetrics[];
  let trendPnlMap: Map<string, PnLData>;
  let trendW: number;
  switch (viewMode) {
    case "monthly": trendRows = monthlyMetrics; trendPnlMap = monthlyPnlMap; trendW = 12; break;
    case "ytd": trendRows = dealMetrics.filter((d) => d.quarter.startsWith(currentYear)); trendPnlMap = pnlMap; trendW = 4; break;
    case "ttm": trendRows = dealMetrics.slice(-4); trendPnlMap = pnlMap; trendW = 4; break;
    default: trendRows = dealMetrics; trendPnlMap = pnlMap; trendW = 4;
  }

  // Year-over-year deltas (compare current vs same period prior year)
  const pyOffset = viewMode === "monthly" ? 12 : 4;
  function delta(fn: (m: DealMetrics[], i: number, w: number) => number | null): number | null {
    if (vIdx < pyOffset) return null;
    const curr = fn(vm, vIdx, kpiW);
    const prev = fn(vm, vIdx - pyOffset, kpiW);
    if (curr === null || prev === null) return null;
    return curr - prev;
  }
  const deltaNRR = delta(calcNRR);
  const deltaGRR = delta(calcGRR);
  const deltaGM = delta((m, i, w) => calcWindowGrossMargin(vp, m, i, w));
  const deltaLtvCac = delta((m, i, w) => { const gm = calcWindowGrossMargin(vp, m, i, w); return calcLtvCac(vp, m, i, gm, w); });
  const deltaEbitda = delta((m, i, w) => {
    const sl = sliceW(m, i, w); let tr = 0, te = 0;
    for (const d of sl) { const p = vp.get(d.quarter); if (p) { tr += p.revenue; te += p.ebitda; } }
    return tr ? (te / tr) * 100 : null;
  });

  // Sparklines (always quarterly TTM for trend stability)
  function sparkData(calcFn: (m: DealMetrics[], i: number, w: number) => number | null): number[] {
    const pts: number[] = [];
    const start = Math.max(0, dealMetrics.length - 6);
    for (let i = start; i < dealMetrics.length; i++) pts.push(calcFn(dealMetrics, i, 4) ?? 0);
    return pts;
  }

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: `linear-gradient(135deg, ${RT_DARK} 0%, #1c1e26 40%, #1a1c24 60%, ${RT_DARK} 100%)` }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 15% 50%, ${RT_RED} 0%, transparent 40%), radial-gradient(circle at 85% 50%, ${RT_BLUE} 0%, transparent 40%)` }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-8 rounded-full" style={{ background: `linear-gradient(180deg, ${RT_RED}, ${RT_BLUE})` }} />
              <h1 className="text-xl font-bold text-white tracking-tight">
                SaaS Metrics Dashboard
              </h1>
              {latest && (
                <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {periodLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 ml-[16px]">
              {latest && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> HubSpot CRM
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> QuickBooks Online
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Proforma Model
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={seedDealMetrics} disabled={seeding}
              className="no-print group px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-500/25"
              style={{ background: `linear-gradient(135deg, ${RT_RED}, #d42f35)` }}>
              {seeding ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Seeding...</span> : dealMetrics.length === 0 ? "Seed Deal Data" : "Re-seed"}
            </button>
            {dealMetrics.length > 0 && (
              <button onClick={syncAllPnl} disabled={syncing}
                className="no-print group px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25"
                style={{ background: `linear-gradient(135deg, ${RT_BLUE}, #2b8fd4)` }}>
                {syncing ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Syncing...</span> : "Sync P&L"}
              </button>
            )}
            {dealMetrics.length > 0 && (
              <button onClick={exportForDeck}
                className="no-print group px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gray-500/25 bg-white/10 border border-white/20 hover:bg-white/20">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Export PDF
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`no-print p-3 rounded-xl text-sm border backdrop-blur-sm ${message.type === "success" ? SENTIMENT_BG.good : SENTIMENT_BG.bad}`}>
          {message.text}
        </div>
      )}

      {loading && (
        <div className="text-center py-24">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-gray-200 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-red-500 rounded-full animate-spin" />
            <div className="absolute inset-1.5 border-2 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
          </div>
          <span className="text-sm text-gray-400">Loading metrics...</span>
        </div>
      )}

      {!loading && dealMetrics.length === 0 && (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gradient-to-b from-white to-gray-50 dark:from-[#1a1d27] dark:to-[#161820]">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${RT_RED}25, ${RT_BLUE}25)` }}>
            <svg className="w-10 h-10" style={{ color: RT_RED }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No metrics data yet</h3>
          <p className="text-sm text-gray-500 mb-6">Seed HubSpot deal data, then sync P&L from QuickBooks.</p>
        </div>
      )}

      {!loading && dealMetrics.length > 0 && (
        <>
          {/* View Toggle */}
          <ViewToggle mode={viewMode} onChange={setViewMode} />

          {/* Primary KPIs */}
          <div className="grid grid-cols-5 gap-3">
            <KpiCard label="LTV : CAC" value={vLtvCac !== null ? fmtRatio(vLtvCac) : "—"} s={sentiment(vLtvCac, { good: 3, ok: 1.5 })} benchmark=">3x" delta={deltaLtvCac} deltaFmt="x" delay={0} period={periodLabel} />
            <KpiCard label="Net Revenue Retention" value={vNRR !== null ? fmtPct(vNRR) : "—"} s={sentiment(vNRR, { good: 110, ok: 100 })} benchmark=">110%" delta={deltaNRR} deltaFmt="pp" delay={1} period={periodLabel} />
            <KpiCard label="Gross Revenue Retention" value={vGRR !== null ? fmtPct(vGRR) : "—"} s={sentiment(vGRR, { good: 90, ok: 80 })} benchmark=">90%" delta={deltaGRR} deltaFmt="pp" delay={2} period={periodLabel} />
            <KpiCard label="Gross Margin" value={vGM !== null ? fmtPct(vGM) : "—"} s={sentiment(vGM, { good: 70, ok: 50 })} benchmark=">70%" delta={deltaGM} deltaFmt="pp" delay={3} period={periodLabel} />
            <KpiCard label="EBITDA Margin" value={vEbitdaMargin !== null ? fmtPct(vEbitdaMargin) : "—"} s={sentiment(vEbitdaMargin, { good: 20, ok: 0 })} benchmark=">20%" delta={deltaEbitda} deltaFmt="pp" delay={4} period={periodLabel} />
          </div>

          {/* Secondary KPIs with sparklines */}
          <div className="grid grid-cols-5 gap-3">
            <KpiCardSmall label="Rule of 40" value={vRuleOf40 !== null ? fmtPct(vRuleOf40) : "—"} s={sentiment(vRuleOf40, { good: 40, ok: 20 })} spark={sparkData((m, i, w) => calcRuleOf40(calcArrGrowth(m, i, w), (() => { const sl = sliceW(m, i, w); let tr=0,te=0; for(const d of sl){const p=pnlMap.get(d.quarter);if(p){tr+=p.revenue;te+=p.ebitda;}} return tr?(te/tr)*100:null; })()))} delay={5} period={periodLabel} />
            <KpiCardSmall label="Quick Ratio" value={vQuickRatio !== null ? fmtRatio(vQuickRatio) : "—"} s={sentiment(vQuickRatio, { good: 4, ok: 2 })} spark={sparkData(calcQuickRatio)} delay={6} period={periodLabel} />
            <KpiCardSmall label="Avg Contract Value" value={vACV !== null ? fmt(vACV) : "—"} s="neutral" spark={sparkData(calcACV)} delay={7} period={periodLabel} />
            <KpiCardSmall label="CAC Payback" value={vCacPayback !== null ? fmtMonths(vCacPayback) : "—"} s={sentiment(vCacPayback, { good: 12, ok: 18 }, false)} spark={sparkData((m, i, w) => calcCacPayback(pnlMap, m, i, calcWindowGrossMargin(pnlMap, m, i, w), w))} delay={8} period={periodLabel} />
            <KpiCardSmall label="ARR Growth" value={vArrGrowth !== null ? fmtPct(vArrGrowth) : "—"} s={sentiment(vArrGrowth, { good: 10, ok: 0 })} spark={sparkData(calcArrGrowth)} delay={9} period={periodLabel} />
          </div>

          {/* Two-column layout: ARR Waterfall + P&L Summary */}
          <div className="grid grid-cols-2 gap-4">
            {/* ARR Waterfall */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1d27] p-5 card-elevated">
              <SectionHeader title="ARR Waterfall" subtitle={periodLabel} icon="waterfall" />
              {waterfallData && (
                <>
                  <div className="mt-3 mb-4 flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight animate-value">{fmt(latestARR)}</span>
                    <span className="text-xs text-gray-400 font-medium">net ARR</span>
                  </div>
                  <ArrWaterfall data={waterfallData} />
                </>
              )}
            </div>

            {/* P&L Summary */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1d27] p-5 card-elevated">
              <SectionHeader title="P&L Summary" subtitle={summaryPnl?.quarter || "No P&L synced"} icon="pnl" />
              {summaryPnl ? (
                <div className="space-y-1.5 mt-4">
                  <PnlRow label="Revenue" value={summaryPnl.revenue} />
                  <PnlRow label="Cost of Goods Sold" value={-summaryPnl.cogs} negative />
                  <PnlDivider />
                  <PnlRow label="Gross Profit" value={summaryPnl.gross_profit} bold />
                  <PnlRow label="Gross Margin" pctValue={summaryPnl.revenue ? calcGrossMargin(summaryPnl) : null} />
                  <PnlDivider />
                  <PnlRow label="Operating Expenses" value={-summaryPnl.operating_expenses} negative />
                  {summaryPnl.sm_expenses > 0 && (
                    <PnlRow label="S&M Expenses" value={-summaryPnl.sm_expenses} negative indent />
                  )}
                  <PnlRow label="Net Income" value={summaryPnl.net_income} bold />
                  <PnlDivider />
                  <div className="rounded-lg p-2.5 -mx-1 mt-1" style={{ background: `linear-gradient(135deg, ${RT_RED}06, ${RT_RED}10)` }}>
                    <PnlRow label="EBITDA" value={summaryPnl.ebitda} bold accent />
                    <PnlRow label="EBITDA Margin" pctValue={summaryPnl.revenue ? (summaryPnl.ebitda / summaryPnl.revenue) * 100 : null} accent />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 mt-4 text-center py-8">
                  Sync P&L from QBO to populate
                </div>
              )}
            </div>
          </div>

          {/* Trends */}
          <div className="print-break-before rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1d27] overflow-hidden card-elevated">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <SectionHeader title={viewMode === "monthly" ? "Monthly Trends" : viewMode === "quarterly" ? "Quarterly Trends" : viewMode === "ytd" ? "YTD Trends" : "TTM Trends"} inline icon="trends" />
              <span className="text-[10px] text-gray-400 font-medium">{trendRows.length} {viewMode === "monthly" ? "months" : "quarters"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider" style={{ background: `linear-gradient(90deg, ${RT_DARK}, #1e2028)`, color: "rgba(255,255,255,0.7)" }}>
                    <th className="px-4 py-3 font-semibold">{viewMode === "monthly" ? "Month" : "Quarter"}</th>
                    <th className="px-4 py-3 font-semibold text-right">New Biz ARR</th>
                    <th className="px-4 py-3 font-semibold text-right">Renewals</th>
                    <th className="px-4 py-3 font-semibold text-right">Expansion</th>
                    <th className="px-4 py-3 font-semibold text-right">Churned</th>
                    <th className="px-4 py-3 font-semibold text-right">NRR</th>
                    <th className="px-4 py-3 font-semibold text-right">GRR</th>
                    <th className="px-4 py-3 font-semibold text-right">Quick Ratio</th>
                    <th className="px-4 py-3 font-semibold text-right">Revenue</th>
                    <th className="px-4 py-3 font-semibold text-right">GM%</th>
                    <th className="px-4 py-3 font-semibold text-right">EBITDA</th>
                    <th className="no-print px-4 py-3 font-semibold text-center">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trendRows.map((d, i) => {
                    const pnl = trendPnlMap.get(d.quarter);
                    const nrr = calcNRR(trendRows, i, trendW);
                    const grr = calcGRR(trendRows, i, trendW);
                    const gm = pnl ? calcGrossMargin(pnl) : null;
                    const qr = calcQuickRatio(trendRows, i, trendW);
                    const isLatest = i === trendRows.length - 1;
                    return (
                      <tr key={d.quarter} className={`group border-b border-gray-100 dark:border-gray-800 transition-all ${isLatest ? "bg-gradient-to-r from-red-50/60 via-red-50/20 to-transparent dark:from-red-900/10 dark:via-red-900/5" : i % 2 === 0 ? "bg-gray-50/40 dark:bg-white/[0.01]" : ""} hover:bg-blue-50/40 dark:hover:bg-blue-900/5`}>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            {isLatest ? (
                              <div className="relative">
                                <div className="w-2 h-2 rounded-full" style={{ background: RT_RED }} />
                                <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-30" style={{ background: RT_RED }} />
                              </div>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-300 dark:group-hover:bg-blue-600 transition-colors" />
                            )}
                            <span className="text-[13px]">{formatPeriod(d.quarter)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">{fmt(d.new_business_arr)}</span>
                          <span className="text-[10px] text-gray-400 ml-1 font-normal">({d.new_business_count})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {d.renewal_arr > 0 ? fmt(d.renewal_arr) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                          {d.expansion_arr > 0 ? `+${fmt(d.expansion_arr)}` : <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: RT_RED }}>
                          {d.churned_arr > 0 ? `-${fmt(d.churned_arr)}` : <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {nrr !== null ? <HeatCell value={nrr} good={110} ok={100} format={fmtPct} /> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {grr !== null ? <HeatCell value={grr} good={90} ok={80} format={fmtPct} /> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {qr !== null ? <HeatCell value={qr} good={4} ok={2} format={fmtRatio} /> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300 font-medium">
                          {pnl ? fmt(pnl.revenue) : <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {gm !== null ? <HeatCell value={gm} good={70} ok={50} format={fmtPct} /> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${pnl ? (pnl.ebitda >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500") : "text-gray-400"}`}>
                          {pnl ? fmt(pnl.ebitda) : <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}
                        </td>
                        <td className="no-print px-4 py-2.5 text-center">
                          {pnl ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            </span>
                          ) : (
                            <button onClick={() => syncPnl(d.quarter)} disabled={syncingPnl === d.quarter}
                              className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-all disabled:opacity-50 hover:scale-105 active:scale-95 border"
                              style={{ color: RT_BLUE, background: `${RT_BLUE}10`, borderColor: `${RT_BLUE}30` }}>
                              {syncingPnl === d.quarter ? "..." : "Sync"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metric Definitions */}
          <details className="group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1d27] card-elevated">
            <summary className="px-5 py-4 cursor-pointer flex items-center justify-between list-none">
              <SectionHeader title="Metric Definitions" inline icon="info" />
              <svg className="w-4 h-4 text-gray-400 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-5 pb-5 grid grid-cols-2 gap-x-8 gap-y-2">
              <MetricDef term="LTV:CAC" definition="Customer lifetime value / acquisition cost. CAC from S&M class expenses / new deals (QBO class tracking)." />
              <MetricDef term="NRR" definition="Net Revenue Retention (TTM). Revenue retained from existing customers including expansion." />
              <MetricDef term="GRR" definition="Gross Revenue Retention (TTM). Revenue retained from renewals only, excluding expansion." />
              <MetricDef term="Rule of 40" definition="ARR growth rate + EBITDA margin. Combined growth and profitability measure." />
              <MetricDef term="Quick Ratio" definition="(New + Expansion ARR) / Churned ARR. Growth efficiency relative to losses." />
              <MetricDef term="CAC Payback" definition="Months to recover CAC from monthly gross profit per customer." />
              <MetricDef term="Gross Margin" definition="(Revenue - COGS) / Revenue. Production efficiency." />
              <MetricDef term="EBITDA Margin" definition="EBITDA / Revenue. Operating profitability before non-cash charges." />
              <MetricDef term="ACV" definition="Average Contract Value. Mean ARR per new business deal." />
              <MetricDef term="ARR Growth" definition="Year-over-year growth in TTM net ARR." />
            </div>
          </details>

          {/* Deck Footer — only visible in print */}
          <DeckFooter quarter={latest?.quarter} />
        </>
      )}
    </div>
  );
}

/* ─── Subcomponents ─── */

function Sparkline({ data, color, height = 24, width = 64 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (data.length < 2 || data.every((v) => v === 0)) return null;
  const filtered = data.filter((v) => v !== 0);
  if (filtered.length < 2) return null;
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min || 1;
  const pad = 2;
  const points = filtered.map((v, i) => {
    const x = pad + (i / (filtered.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });
  const areaPoints = [...points, `${pad + ((filtered.length - 1) / (filtered.length - 1)) * (width - pad * 2)},${height}`, `${pad},${height}`];
  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(" ")} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].split(",")[0]} cy={points[points.length - 1].split(",")[1]} r="2" fill={color} />
    </svg>
  );
}

function DeltaBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  const isPos = value > 0;
  const color = isPos ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/50 dark:border-emerald-800/50" : "text-red-500 bg-red-50 dark:bg-red-900/30 border-red-200/50 dark:border-red-800/50";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${color}`}>
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          {isPos ? <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            : <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />}
        </svg>
        {isPos ? "+" : ""}{Math.abs(value).toFixed(1)}{suffix}
      </span>
      <span className="text-[8px] text-gray-400 font-medium tracking-wide">vs PY</span>
    </div>
  );
}

function HeatCell({ value, good, ok, format }: { value: number; good: number; ok: number; format: (n: number) => string }) {
  const s = sentiment(value, { good, ok });
  const bgMap: Record<Sentiment, string> = {
    good: "bg-emerald-50/80 dark:bg-emerald-900/15",
    ok: "bg-amber-50/80 dark:bg-amber-900/15",
    bad: "bg-red-50/80 dark:bg-red-900/15",
    neutral: "",
  };
  return (
    <span className={`inline-block font-bold px-1.5 py-0.5 rounded ${bgMap[s]} ${SENTIMENT_COLORS[s]}`}>
      {format(value)}
    </span>
  );
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { value: ViewMode; label: string; desc: string }[] = [
    { value: "monthly", label: "Monthly", desc: "Per-month view" },
    { value: "quarterly", label: "Quarterly", desc: "Single quarter" },
    { value: "ytd", label: "YTD", desc: "Year to date" },
    { value: "ttm", label: "TTM", desc: "Trailing 12 months" },
  ];
  return (
    <div className="no-print flex items-center gap-3">
      <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1d27] p-1 shadow-sm">
        {modes.map((m) => (
          <button key={m.value} onClick={() => onChange(m.value)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === m.value
                ? "text-white shadow-sm"
                : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
            style={mode === m.value ? { background: `linear-gradient(135deg, ${RT_RED}, #d42f35)` } : undefined}>
            {m.label}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-gray-400 font-medium">{modes.find((m) => m.value === mode)?.desc}</span>
    </div>
  );
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  waterfall: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h2v8H3zm6-4h2v12H9zm6-3h2v15h-2zm6-4h2v19h-2z" /></svg>,
  pnl: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  trends: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  info: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

function SectionHeader({ title, subtitle, inline, icon }: { title: string; subtitle?: string; inline?: boolean; icon?: string }) {
  return (
    <div className={`flex items-center gap-2 ${inline ? "" : ""}`}>
      {icon && <span className="text-gray-400">{SECTION_ICONS[icon]}</span>}
      <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">{title}</h2>
      {subtitle && <span className="text-xs text-gray-400 font-normal">— {subtitle}</span>}
    </div>
  );
}

function KpiCard({ label, value, s, benchmark, delta, deltaFmt, delay = 0, period }: { label: string; value: string; s: Sentiment; benchmark: string; delta?: number | null; deltaFmt?: string; delay?: number; period?: string }) {
  return (
    <div className={`relative rounded-2xl border p-4 overflow-hidden card-elevated ${SENTIMENT_BG[s]}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${SENTIMENT_GRADIENT[s]}`} />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${SENTIMENT_DOT[s]}`} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
        </div>
        {period && <span className="text-[9px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{period}</span>}
      </div>
      <div className="flex items-end justify-between">
        <div className={`text-3xl font-extrabold tabular-nums tracking-tight animate-value ${SENTIMENT_COLORS[s]}`} style={{ animationDelay: `${delay * 0.06}s` }}>{value}</div>
        {delta !== null && delta !== undefined && (
          <DeltaBadge value={delta} suffix={deltaFmt === "pp" ? "pp" : deltaFmt === "x" ? "x" : ""} />
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-2.5 flex items-center gap-1.5">
        <span className="w-3 h-[1px] bg-gray-300 dark:bg-gray-600" />
        <span className="font-medium">Target {benchmark}</span>
      </div>
    </div>
  );
}

function KpiCardSmall({ label, value, s, spark, delay = 0, period }: { label: string; value: string; s: Sentiment | "neutral"; spark?: number[]; delay?: number; period?: string }) {
  const sVal = s as Sentiment;
  const SPARK_COLORS: Record<Sentiment, string> = { good: "#10B981", ok: "#F59E0B", bad: "#EF4444", neutral: "#9CA3AF" };
  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1d27] p-3 overflow-hidden card-elevated">
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${SENTIMENT_GRADIENT[sVal]}`} />
      {period && <div className="text-[8px] font-mono text-gray-400 mb-1.5">{period}</div>}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{label}</div>
          <div className={`text-xl font-extrabold tabular-nums tracking-tight animate-value ${SENTIMENT_COLORS[sVal]}`} style={{ animationDelay: `${delay * 0.06}s` }}>{value}</div>
        </div>
        {spark && <Sparkline data={spark} color={SPARK_COLORS[sVal]} />}
      </div>
    </div>
  );
}

function ArrWaterfall({ data }: { data: DealMetrics }) {
  const maxVal = Math.max(data.new_business_arr, data.renewal_arr, data.expansion_arr, data.churned_arr, 1);
  const barPct = (v: number) => Math.max((v / maxVal) * 100, 4);
  const items: { label: string; value: number; count: number; pct: number; colors: [string, string]; negative?: boolean }[] = [
    { label: "New Business", value: data.new_business_arr, count: data.new_business_count, pct: barPct(data.new_business_arr), colors: [RT_BLUE, "#5bb5f0"] },
    { label: "Renewals", value: data.renewal_arr, count: data.renewal_count, pct: barPct(data.renewal_arr), colors: ["#10B981", "#34D399"] },
    { label: "Expansion", value: data.expansion_arr, count: data.expansion_count, pct: barPct(data.expansion_arr), colors: ["#34D399", "#6EE7B7"] },
    { label: "Churned", value: -data.churned_arr, count: data.churned_count, pct: barPct(data.churned_arr), colors: [RT_RED, "#f56565"], negative: true },
  ];
  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={item.label} className="group flex items-center gap-2.5">
          <div className="w-[72px] text-[11px] font-medium text-gray-500 dark:text-gray-400 text-right shrink-0">{item.label}</div>
          <div className="flex-1 h-8 relative">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`wf-${idx}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={item.colors[0]} />
                  <stop offset="100%" stopColor={item.colors[1]} />
                </linearGradient>
              </defs>
              <rect x="0" y="2" width="100%" height="28" rx="6" fill="#f3f4f6" />
              <rect x="0" y="2" width={`${item.pct}%`} height="28" rx="6" fill={`url(#wf-${idx})`} className="transition-all duration-700 ease-out group-hover:brightness-110">
                <animate attributeName="width" from="0%" to={`${item.pct}%`} dur="0.8s" begin={`${idx * 0.1}s`} fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1" />
              </rect>
            </svg>
          </div>
          <div className={`w-[60px] text-right text-xs tabular-nums font-bold ${item.negative ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>
            {fmt(item.value)}
          </div>
          <div className="w-8 text-right text-[10px] text-gray-400 tabular-nums font-medium">{item.count}</div>
        </div>
      ))}
    </div>
  );
}

function PnlRow({ label, value, pctValue, bold, negative, accent, indent }: { label: string; value?: number; pctValue?: number | null; bold?: boolean; negative?: boolean; accent?: boolean; indent?: boolean }) {
  const displayVal = pctValue !== undefined ? (pctValue !== null ? fmtPct(pctValue) : "—") : (value !== undefined ? fmtFull(value) : "—");
  return (
    <div className={`flex justify-between items-center py-1 ${bold ? "font-semibold" : ""}`}>
      <span className={`text-sm ${indent ? "pl-4 text-gray-400 dark:text-gray-500 italic" : bold ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${
        accent ? "font-bold" : bold ? "text-gray-900 dark:text-white" : negative ? "text-red-500" : indent ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"
      }`} style={accent ? { color: RT_RED } : undefined}>
        {displayVal}
      </span>
    </div>
  );
}

function PnlDivider() {
  return <div className="border-t border-gray-100 dark:border-gray-800 my-1" />;
}

function MetricDef({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="flex gap-3 py-1.5 group">
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 shrink-0 w-24 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-center group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">{term}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{definition}</span>
    </div>
  );
}

function DeckFooter({ quarter }: { quarter?: string }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="hidden print:flex items-center justify-between pt-6 mt-6 border-t border-gray-200 text-[10px] text-gray-400">
      <div className="flex items-center gap-2">
        <div className="w-0.5 h-3 rounded-full" style={{ background: `linear-gradient(180deg, ${RT_RED}, ${RT_BLUE})` }} />
        <span className="font-bold text-gray-600">RedTeam Software</span>
        <span>SaaS Metrics — TTM ending {quarter}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>Confidential</span>
        <span className="text-gray-300">|</span>
        <span>Generated {dateStr}</span>
      </div>
    </div>
  );
}
