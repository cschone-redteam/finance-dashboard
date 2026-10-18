"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

const PRODUCTS = ["Flex", "Go", "FieldLens", "TeamPlayer"] as const;
type Product = (typeof PRODUCTS)[number];

type WaterfallMonth = {
  billings: Record<Product, number> & { total: number };
  revenue: Record<Product, number> & { total: number };
  beginningDR: number;
  endingDR: number;
};

type WaterfallData = {
  months: Record<string, WaterfallMonth>;
  monthKeys: string[];
  qboBalance: number | null;
  sources: string[];
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function monthLabel(key: string): string {
  const [yyyy, mm] = key.split("-");
  return `${MONTH_LABELS[mm] || mm} ${yyyy}`;
}

function fmt$(n: number): string {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type FlatRow = {
  month: string;
  monthDisplay: string;
  category: string;
  product: string;
  source: string;
  amount: number;
  isSummary: boolean;
  isFirstInMonth: boolean;
};

const BILLING_SOURCE: Record<string, string> = {
  Flex: "Chargebee",
  Go: "HubSpot",
  FieldLens: "HubSpot",
  TeamPlayer: "HubSpot",
};

function flattenWaterfall(data: WaterfallData): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const key of data.monthKeys) {
    const m = data.months[key];
    const display = monthLabel(key);
    let first = true;
    const push = (category: string, product: string, source: string, amount: number, isSummary: boolean) => {
      rows.push({ month: key, monthDisplay: display, category, product, source, amount, isSummary, isFirstInMonth: first });
      first = false;
    };

    push("Beginning Balance", "", "", m.beginningDR, true);

    for (const p of PRODUCTS) {
      if (m.billings[p] !== 0) push("Billings", p, BILLING_SOURCE[p], m.billings[p], false);
    }
    push("Total Billings", "", "", m.billings.total, true);

    for (const p of PRODUCTS) {
      if (m.revenue[p] !== 0) push("Revenue Recognized", p, "QBO", -m.revenue[p], false);
    }
    push("Total Revenue Recognized", "", "", -m.revenue.total, true);

    push("Ending Balance", "", "", m.endingDR, true);
  }
  return rows;
}

function downloadCSV(rows: FlatRow[]) {
  const headers = ["Month", "Category", "Product", "Source", "Amount"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [r.monthDisplay, `"${r.category}"`, r.product || "", r.source || "", r.amount.toFixed(2)].join(","),
    );
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deferred-revenue-waterfall-${new Date().getFullYear()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DeferredRevenuePage() {
  const [waterfall, setWaterfall] = useState<WaterfallData | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/deferred-revenue");
      const data = await res.json();
      if (data.waterfall) {
        setWaterfall(data.waterfall);
        setSyncedAt(data.synced_at);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/deferred-revenue", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Sync failed");
        return;
      }
      setWaterfall(data.waterfall);
      setSyncedAt(data.synced_at);
    } catch {
      setSyncError("Failed to connect to sync endpoint");
    } finally {
      setSyncing(false);
    }
  }, []);

  const flatRows = useMemo(() => {
    if (!waterfall || waterfall.monthKeys.length === 0) return [];
    return flattenWaterfall(waterfall);
  }, [waterfall]);

  const summary = useMemo(() => {
    if (!waterfall) return null;
    const keys = waterfall.monthKeys;
    if (keys.length === 0) return null;

    let ytdBillings = 0;
    let ytdRevenue = 0;
    for (const k of keys) {
      const m = waterfall.months[k];
      ytdBillings += m.billings.total;
      ytdRevenue += m.revenue.total;
    }
    const lastMonth = waterfall.months[keys[keys.length - 1]];
    return {
      endingBalance: lastMonth.endingDR,
      ytdBillings,
      ytdRevenue,
      netChange: ytdBillings - ytdRevenue,
      qboBalance: waterfall.qboBalance,
    };
  }, [waterfall]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Deferred Revenue
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Waterfall from QuickBooks, HubSpot, and Chargebee
          </p>
        </div>

        {syncError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
            {syncError}
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 dark:bg-white/[0.1] text-white shadow-sm hover:bg-gray-800 dark:hover:bg-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {syncing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            )}
            {syncing ? "Syncing..." : "Sync All Sources"}
          </button>
          {flatRows.length > 0 && (
            <button
              onClick={() => downloadCSV(flatRows)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
          )}
          {syncedAt && (
            <span className="text-xs text-gray-400">
              Synced{" "}
              {new Date(syncedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
          {waterfall?.sources && waterfall.sources.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              {waterfall.sources.includes("qbo-pnl") && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">QBO</span>
              )}
              {waterfall.sources.includes("hubspot") && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">HubSpot</span>
              )}
              {waterfall.sources.includes("chargebee") && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Chargebee</span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : !waterfall || waterfall.monthKeys.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">No deferred revenue data</p>
            <p className="text-xs text-gray-400 mt-1">Click &quot;Sync All Sources&quot; to pull data from QBO, HubSpot, and Chargebee</p>
          </div>
        ) : (
          <>
            {summary && (
              <div className="flex gap-4 mb-6">
                <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ending DR Balance</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5 font-mono">
                    {fmt$(summary.endingBalance)}
                  </div>
                </div>
                <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">YTD Billings</div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400 mt-0.5 font-mono">
                    {fmt$(summary.ytdBillings)}
                  </div>
                </div>
                <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">YTD Revenue Recognized</div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
                    {fmt$(summary.ytdRevenue)}
                  </div>
                </div>
                <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">YTD Net Change</div>
                  <div className={`text-lg font-semibold mt-0.5 font-mono ${summary.netChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {fmt$(summary.netChange)}
                  </div>
                </div>
                {summary.qboBalance !== null && (
                  <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">QBO Balance Sheet</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5 font-mono">
                      {fmt$(summary.qboBalance)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[140px]">Month</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[120px]">Product</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[110px]">Source</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[140px]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((row, i) => (
                    <tr
                      key={i}
                      className={`
                        ${row.isFirstInMonth && i > 0 ? "border-t-2 border-gray-200 dark:border-white/[0.08]" : "border-t border-gray-100 dark:border-white/[0.03]"}
                        ${row.isSummary ? "bg-gray-50/60 dark:bg-white/[0.015]" : ""}
                        hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors
                      `}
                    >
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
                        {row.isFirstInMonth ? row.monthDisplay : ""}
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap ${row.isSummary ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400 pl-8"}`}>
                        {row.category}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {row.product}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.source && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium
                            ${row.source === "QBO" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : ""}
                            ${row.source === "HubSpot" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" : ""}
                            ${row.source === "Chargebee" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : ""}
                          `}>
                            {row.source}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono whitespace-nowrap
                        ${row.isSummary ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}
                        ${row.amount < 0 ? "text-red-600 dark:text-red-400" : ""}
                      `}>
                        {row.amount === 0
                          ? <span className="text-gray-300 dark:text-gray-600">—</span>
                          : fmt$(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
              <span>Flex Billings: Chargebee only</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>Go / FieldLens / TeamPlayer Billings: HubSpot bookings</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>Revenue Recognized: QBO P&L (no Chargebee overlap)</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
