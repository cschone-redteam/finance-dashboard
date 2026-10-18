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

const SHORT_MONTHS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function colLabel(key: string): string {
  const [, mm] = key.split("-");
  return SHORT_MONTHS[mm] || key;
}

function fmt$(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCell(n: number, dash?: boolean): string {
  if (n === 0 && dash) return "—";
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "(" : ""}$${(abs / 1_000_000).toFixed(1)}M${n < 0 ? ")" : ""}`;
  if (abs >= 1_000) return `${n < 0 ? "(" : ""}$${(abs / 1_000).toFixed(0)}K${n < 0 ? ")" : ""}`;
  return fmt$(n);
}

const SOURCE_TAG: Record<string, string> = {
  Flex: "Chargebee",
  Go: "HubSpot",
  FieldLens: "HubSpot",
  TeamPlayer: "HubSpot",
};

type RowKind = "header" | "detail" | "subtotal" | "total" | "spacer" | "balance" | "reconcile";

type MatrixRow = {
  kind: RowKind;
  label: string;
  source?: string;
  values: number[];
  ytd: number;
};

function buildMatrix(data: WaterfallData): MatrixRow[] {
  const { months, monthKeys } = data;
  const rows: MatrixRow[] = [];

  const vals = (fn: (m: WaterfallMonth) => number) => monthKeys.map((k) => fn(months[k]));
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  // Beginning Balance
  rows.push({
    kind: "balance",
    label: "Beginning Deferred Balance",
    values: vals((m) => m.beginningDR),
    ytd: months[monthKeys[0]]?.beginningDR ?? 0,
  });

  rows.push({ kind: "spacer", label: "", values: [], ytd: 0 });

  // Additions header
  rows.push({ kind: "header", label: "Deferred Revenue Additions", values: [], ytd: 0 });

  for (const p of PRODUCTS) {
    const v = vals((m) => m.billings[p]);
    rows.push({ kind: "detail", label: `  ${p}`, source: SOURCE_TAG[p], values: v, ytd: sum(v) });
  }

  const totalAdd = vals((m) => m.billings.total);
  rows.push({ kind: "subtotal", label: "Total Deferred Additions", values: totalAdd, ytd: sum(totalAdd) });

  rows.push({ kind: "spacer", label: "", values: [], ytd: 0 });

  // Subtractions header
  rows.push({ kind: "header", label: "Deferred Revenue Subtractions", values: [], ytd: 0 });

  for (const p of PRODUCTS) {
    const v = vals((m) => -m.revenue[p]);
    rows.push({ kind: "detail", label: `  ${p}`, source: "QBO", values: v, ytd: sum(v) });
  }

  const totalSub = vals((m) => -m.revenue.total);
  rows.push({ kind: "subtotal", label: "Total Deferred Subtractions", values: totalSub, ytd: sum(totalSub) });

  rows.push({ kind: "spacer", label: "", values: [], ytd: 0 });

  // Net change
  const netChange = vals((m) => m.billings.total - m.revenue.total);
  rows.push({ kind: "total", label: "Total Change in Deferred Balance", values: netChange, ytd: sum(netChange) });

  rows.push({ kind: "spacer", label: "", values: [], ytd: 0 });

  // QBO Actual
  if (data.qboBalance !== null) {
    const qboVals = monthKeys.map(() => 0);
    // Place the QBO balance at the last month that has actual revenue data
    const lastActualIdx = monthKeys.reduce((last, k, i) => (months[k].revenue.total > 0 ? i : last), -1);
    if (lastActualIdx >= 0) qboVals[lastActualIdx] = data.qboBalance;
    rows.push({ kind: "reconcile", label: "Deferred Balance from QuickBooks", source: "QBO", values: qboVals, ytd: data.qboBalance });
  }

  // Ending balance
  rows.push({
    kind: "total",
    label: "Total Deferred Balance",
    values: vals((m) => m.endingDR),
    ytd: months[monthKeys[monthKeys.length - 1]]?.endingDR ?? 0,
  });

  return rows;
}

function downloadCSV(rows: MatrixRow[], monthKeys: string[]) {
  const headers = ["", ...monthKeys.map(colLabel), "YTD"];
  const lines = [headers.join(",")];
  for (const row of rows) {
    if (row.kind === "spacer") { lines.push(""); continue; }
    if (row.kind === "header") { lines.push(`"${row.label}"`); continue; }
    const cells = row.values.map((v) => v.toFixed(2));
    lines.push([`"${row.label.trim()}"`, ...cells, row.ytd.toFixed(2)].join(","));
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/deferred-revenue", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSyncError(data.error || "Sync failed"); return; }
      setWaterfall(data.waterfall);
      setSyncedAt(data.synced_at);
    } catch {
      setSyncError("Failed to connect to sync endpoint");
    } finally {
      setSyncing(false);
    }
  }, []);

  const matrix = useMemo(() => {
    if (!waterfall || waterfall.monthKeys.length === 0) return null;
    return buildMatrix(waterfall);
  }, [waterfall]);

  const summary = useMemo(() => {
    if (!waterfall) return null;
    const keys = waterfall.monthKeys;
    if (keys.length === 0) return null;
    let ytdAdd = 0, ytdSub = 0;
    for (const k of keys) {
      ytdAdd += waterfall.months[k].billings.total;
      ytdSub += waterfall.months[k].revenue.total;
    }
    const last = waterfall.months[keys[keys.length - 1]];
    return { endingBalance: last.endingDR, ytdAdd, ytdSub, netChange: ytdAdd - ytdSub, qboBalance: waterfall.qboBalance };
  }, [waterfall]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Deferred Revenue Waterfall</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">QuickBooks + HubSpot + Chargebee</p>
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
          {matrix && (
            <button
              onClick={() => downloadCSV(matrix, waterfall!.monthKeys)}
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
              {new Date(syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {waterfall?.sources && waterfall.sources.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              {waterfall.sources.includes("qbo-pnl") && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">QBO</span>}
              {waterfall.sources.includes("hubspot") && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">HubSpot</span>}
              {waterfall.sources.includes("chargebee") && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Chargebee</span>}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : !waterfall || !matrix ? (
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
                <SummaryCard label="Total Deferred Balance" value={fmt$(summary.endingBalance)} />
                <SummaryCard label="YTD Additions" value={fmt$(summary.ytdAdd)} color="green" />
                <SummaryCard label="YTD Subtractions" value={fmt$(-summary.ytdSub)} color="red" />
                <SummaryCard label="YTD Net Change" value={fmt$(summary.netChange)} color={summary.netChange >= 0 ? "green" : "red"} />
                {summary.qboBalance !== null && <SummaryCard label="QBO Balance Sheet" value={fmt$(summary.qboBalance)} />}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-[#111] z-10 min-w-[260px]">
                      {new Date().getFullYear()} Deferred Revenue Worksheet
                    </th>
                    {waterfall.monthKeys.map((k) => (
                      <th key={k} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                        {colLabel(k)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider min-w-[100px] bg-gray-100/80 dark:bg-white/[0.04]">
                      YTD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => {
                    if (row.kind === "spacer") {
                      return <tr key={i} className="h-3"><td colSpan={waterfall.monthKeys.length + 2} /></tr>;
                    }

                    if (row.kind === "header") {
                      return (
                        <tr key={i}>
                          <td
                            colSpan={waterfall.monthKeys.length + 2}
                            className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 sticky left-0 bg-white dark:bg-[#0a0a0a] z-10"
                          >
                            {row.label}
                          </td>
                        </tr>
                      );
                    }

                    const isNeg = row.kind === "detail" && row.values.some((v) => v < 0);
                    const isBold = row.kind === "subtotal" || row.kind === "total" || row.kind === "balance";
                    const hasBorder = row.kind === "subtotal" || row.kind === "total";

                    return (
                      <tr
                        key={i}
                        className={`
                          ${hasBorder ? "border-t border-gray-200 dark:border-white/[0.06]" : ""}
                          ${row.kind === "total" ? "bg-gray-50/60 dark:bg-white/[0.015]" : ""}
                          ${row.kind === "balance" ? "bg-gray-50/40 dark:bg-white/[0.01]" : ""}
                          ${row.kind === "reconcile" ? "border-t border-dashed border-gray-300 dark:border-white/[0.08]" : ""}
                          hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors
                        `}
                      >
                        <td
                          className={`px-4 py-1.5 whitespace-nowrap sticky left-0 z-10
                            ${isBold ? "font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#0a0a0a]" : "text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0a0a0a]"}
                            ${row.kind === "total" ? "bg-gray-50/60 dark:bg-[#0e0e0e]" : ""}
                            ${row.kind === "balance" ? "bg-gray-50/40 dark:bg-[#0c0c0c]" : ""}
                          `}
                        >
                          <span className="flex items-center gap-2">
                            {row.label}
                            {row.source && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium
                                ${row.source === "QBO" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : ""}
                                ${row.source === "HubSpot" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" : ""}
                                ${row.source === "Chargebee" ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : ""}
                              `}>
                                {row.source}
                              </span>
                            )}
                          </span>
                        </td>
                        {row.values.map((v, j) => (
                          <td
                            key={j}
                            className={`px-3 py-1.5 text-right font-mono whitespace-nowrap text-[13px]
                              ${isBold ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}
                              ${(v < 0 || isNeg) && v !== 0 ? "text-red-600 dark:text-red-400" : ""}
                            `}
                          >
                            {v === 0
                              ? <span className="text-gray-300 dark:text-gray-700">—</span>
                              : fmtCell(v)}
                          </td>
                        ))}
                        <td
                          className={`px-3 py-1.5 text-right font-mono whitespace-nowrap text-[13px] bg-gray-50/80 dark:bg-white/[0.02]
                            ${isBold ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}
                            ${row.ytd < 0 ? "text-red-600 dark:text-red-400" : ""}
                          `}
                        >
                          {row.ytd === 0
                            ? <span className="text-gray-300 dark:text-gray-700">—</span>
                            : fmtCell(row.ytd)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
              <span>Additions: Flex from Chargebee invoices, Go / FieldLens / TeamPlayer from HubSpot bookings</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>Subtractions: Revenue recognized from QBO P&L</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  const colorClass = color === "green"
    ? "text-green-600 dark:text-green-400"
    : color === "red"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-900 dark:text-white";
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 font-mono ${colorClass}`}>{value}</div>
    </div>
  );
}
