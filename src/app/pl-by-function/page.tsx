"use client";

import { useEffect, useState } from "react";
import { QboConnect } from "@/components/qbo-connect";
import type { PLByFunctionData } from "@/lib/gl-mapping";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const ACTUAL_THROUGH = 6;

type RowConfig = {
  label: string;
  key: string;
  indent?: boolean;
  bold?: boolean;
  isSummary?: boolean;
  isPercent?: boolean;
  isNegative?: boolean;
  topBorder?: boolean;
  blankAfter?: boolean;
};

const ROWS: RowConfig[] = [
  { label: "Revenue", key: "_revenue_header", bold: true },
  { label: "Flex", key: "rev_Flex", indent: true },
  { label: "Go", key: "rev_Go", indent: true },
  { label: "Fieldlens", key: "rev_Fieldlens", indent: true },
  { label: "Other", key: "rev_Other", indent: true },
  { label: "Discounts", key: "rev_Discounts", indent: true, isNegative: true },
  { label: "Total Revenue", key: "total_revenue", bold: true, isSummary: true, topBorder: true, blankAfter: true },
  { label: "Cost of Revenue", key: "_cogs_header", bold: true },
  { label: "CX", key: "cogs_CX", indent: true },
  { label: "Infrastructure", key: "cogs_Infrastructure", indent: true },
  { label: "Total Cost of Revenue", key: "total_cogs", bold: true, isSummary: true, topBorder: true, blankAfter: true },
  { label: "Gross Profit", key: "gross_profit", bold: true, isSummary: true },
  { label: "Gross Margin %", key: "gross_margin_pct", isPercent: true, blankAfter: true },
  { label: "Operating Expenses", key: "_opex_header", bold: true },
  { label: "G&A", key: "opex_G&A", indent: true },
  { label: "Sales", key: "opex_Sales", indent: true },
  { label: "Marketing", key: "opex_Marketing", indent: true },
  { label: "Product & Engineering", key: "opex_R&D", indent: true },
  { label: "Total Operating Expenses", key: "total_opex", bold: true, isSummary: true, topBorder: true, blankAfter: true },
  { label: "Operating Income", key: "operating_income", bold: true, isSummary: true },
  { label: "Operating Margin %", key: "operating_margin_pct", isPercent: true, blankAfter: true },
  { label: "Other Income / (Expense)", key: "_other_header", bold: true },
  { label: "Interest Expense", key: "other_interest", indent: true },
  { label: "Amortization", key: "other_amortization", indent: true },
  { label: "Depreciation", key: "other_depreciation", indent: true },
  { label: "Total Other", key: "total_other", bold: true, isSummary: true, topBorder: true, blankAfter: true },
  { label: "Net Income Before Tax", key: "net_before_tax", bold: true, isSummary: true },
  { label: "Federal Tax", key: "tax", indent: true },
  { label: "Net Income", key: "net_income", bold: true, isSummary: true, topBorder: true },
];

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function computeRows(data: PLByFunctionData): Record<string, number[]> {
  const rows: Record<string, number[]> = {};
  const z = () => new Array(12).fill(0);

  for (const key of ["Flex", "Go", "Fieldlens", "Other", "Discounts"] as const) {
    rows[`rev_${key}`] = data.revenue[key];
  }
  rows.total_revenue = z();
  for (let m = 0; m < 12; m++) {
    rows.total_revenue[m] = sum(Object.values(data.revenue).map(a => a[m]));
  }

  for (const key of ["CX", "Infrastructure"] as const) {
    rows[`cogs_${key}`] = data.cogs[key];
  }
  rows.total_cogs = z();
  for (let m = 0; m < 12; m++) {
    rows.total_cogs[m] = sum(Object.values(data.cogs).map(a => a[m]));
  }

  rows.gross_profit = z();
  rows.gross_margin_pct = z();
  for (let m = 0; m < 12; m++) {
    rows.gross_profit[m] = rows.total_revenue[m] - rows.total_cogs[m];
    rows.gross_margin_pct[m] = rows.total_revenue[m] !== 0
      ? (rows.gross_profit[m] / rows.total_revenue[m]) * 100 : 0;
  }

  for (const key of ["G&A", "Sales", "Marketing", "R&D"] as const) {
    rows[`opex_${key}`] = data.opex[key];
  }
  rows.total_opex = z();
  for (let m = 0; m < 12; m++) {
    rows.total_opex[m] = sum(Object.values(data.opex).map(a => a[m]));
  }

  rows.operating_income = z();
  rows.operating_margin_pct = z();
  for (let m = 0; m < 12; m++) {
    rows.operating_income[m] = rows.gross_profit[m] - rows.total_opex[m];
    rows.operating_margin_pct[m] = rows.total_revenue[m] !== 0
      ? (rows.operating_income[m] / rows.total_revenue[m]) * 100 : 0;
  }

  rows.other_interest = data.other.interest;
  rows.other_amortization = data.other.amortization;
  rows.other_depreciation = data.other.depreciation;
  rows.total_other = z();
  for (let m = 0; m < 12; m++) {
    rows.total_other[m] = data.other.interest[m] + data.other.amortization[m] + data.other.depreciation[m];
  }

  rows.net_before_tax = z();
  rows.tax = data.other.tax;
  rows.net_income = z();
  for (let m = 0; m < 12; m++) {
    rows.net_before_tax[m] = rows.operating_income[m] - rows.total_other[m];
    rows.net_income[m] = rows.net_before_tax[m] - data.other.tax[m];
  }

  return rows;
}

function fmtCurrency(n: number): string {
  if (Math.abs(n) < 0.5) return "—";
  const abs = Math.abs(n);
  const str = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(abs);
  return n < 0 ? `(${str})` : str;
}

function fmtPercent(n: number): string {
  if (Math.abs(n) < 0.01) return "—";
  return `${n.toFixed(1)}%`;
}

export default function PLByFunctionPage() {
  const [plData, setPlData] = useState<PLByFunctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string>("seed");
  const [qboConnected, setQboConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pl-by-function")
      .then((r) => r.json())
      .then((d) => {
        const { synced_at, source: src, ...rest } = d;
        setPlData(rest as PLByFunctionData);
        setSyncedAt(synced_at);
        setSource(src || "seed");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function syncFromQbo() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/pl-by-function", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      const d = await res.json();
      const { synced_at, source: src, ...rest } = d;
      setPlData(rest as PLByFunctionData);
      setSyncedAt(synced_at);
      setSource(src || "qbo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  }

  const rows = plData ? computeRows(plData) : null;

  function ytd(key: string): number {
    if (!rows || !rows[key]) return 0;
    return rows[key].slice(0, ACTUAL_THROUGH + 1).reduce((a, b) => a + b, 0);
  }

  function fullYear(key: string): number {
    if (!rows || !rows[key]) return 0;
    return rows[key].reduce((a, b) => a + b, 0);
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              P&L by Function
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Profit &amp; Loss by functional area — 2026 YTD Actual + 8+4 Forecast
            </p>
            <div className="flex items-center gap-3 mt-2">
              {syncedAt && (
                <span className="text-[11px] text-gray-400">
                  Last synced {new Date(syncedAt).toLocaleString()}
                </span>
              )}
              {source === "seed" && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                  Seed Data
                </span>
              )}
              {source === "qbo" && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                  QBO Live
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <QboConnect onStatusChange={setQboConnected} />
            {qboConnected && (
              <button
                onClick={syncFromQbo}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 dark:bg-white/[0.1] hover:bg-gray-800 dark:hover:bg-white/[0.15] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {syncing ? (
                  <>
                    <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    Syncing QBO…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M21.015 4.356v4.992" />
                    </svg>
                    Sync from QBO
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-[#EF373E] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02]">
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-[#141414] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-white/[0.06] min-w-[200px]">
                    &nbsp;
                  </th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={m}
                      className={`px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-white/[0.06] min-w-[100px] ${
                        i <= ACTUAL_THROUGH
                          ? "text-gray-600 dark:text-gray-300"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      <div>{m} 26</div>
                      <div className={`text-[9px] font-medium mt-0.5 ${
                        i <= ACTUAL_THROUGH
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-500 dark:text-amber-500"
                      }`}>
                        {i <= ACTUAL_THROUGH ? "Actual" : "8+4 Fcst"}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-b border-l border-gray-200 dark:border-white/[0.06] text-emerald-600 dark:text-emerald-400 min-w-[100px]">
                    <div>YTD</div>
                    <div className="text-[9px] font-medium mt-0.5">Jan–Jul</div>
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-b border-l border-gray-200 dark:border-white/[0.06] text-gray-600 dark:text-gray-300 min-w-[100px]">
                    <div>FY 2026</div>
                    <div className="text-[9px] font-medium mt-0.5">Full Year</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const isHeader = row.key.startsWith("_");
                  const vals = rows?.[row.key];

                  return (
                    <tr
                      key={row.key}
                      className={`${
                        row.bold && !isHeader ? "bg-gray-50/50 dark:bg-white/[0.015]" : ""
                      } ${row.topBorder ? "border-t border-gray-300 dark:border-white/[0.12]" : ""}`}
                    >
                      <td
                        className={`sticky left-0 z-10 px-4 py-1.5 border-r border-gray-200 dark:border-white/[0.06] whitespace-nowrap ${
                          row.bold
                            ? "font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-[#141414]"
                            : "text-gray-700 dark:text-gray-300 bg-white dark:bg-[#0a0a0a]"
                        } ${row.indent ? "pl-8" : ""} ${
                          row.blankAfter ? "border-b-2 border-gray-200 dark:border-white/[0.06]" : "border-b border-gray-100 dark:border-white/[0.03]"
                        }`}
                      >
                        {row.label}
                      </td>
                      {MONTHS.map((_, i) => {
                        if (isHeader) {
                          return (
                            <td
                              key={i}
                              className={`px-3 py-1.5 ${
                                row.blankAfter ? "border-b-2 border-gray-200 dark:border-white/[0.06]" : "border-b border-gray-100 dark:border-white/[0.03]"
                              } ${i > ACTUAL_THROUGH ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                            />
                          );
                        }
                        const val = vals?.[i] ?? 0;
                        const formatted = row.isPercent ? fmtPercent(val) : fmtCurrency(val);
                        const isNeg = val < 0 || (row.isNegative && val !== 0);
                        return (
                          <td
                            key={i}
                            className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap ${
                              row.blankAfter ? "border-b-2 border-gray-200 dark:border-white/[0.06]" : "border-b border-gray-100 dark:border-white/[0.03]"
                            } ${row.bold ? "font-bold text-gray-900 dark:text-white" : ""} ${
                              isNeg && !row.isPercent ? "text-red-600 dark:text-red-400" : ""
                            } ${!row.bold && !isNeg ? "text-gray-700 dark:text-gray-300" : ""} ${
                              i > ACTUAL_THROUGH ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                            }`}
                          >
                            {formatted}
                          </td>
                        );
                      })}
                      {/* YTD */}
                      <td
                        className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap border-l ${
                          row.blankAfter ? "border-b-2 border-gray-200 dark:border-white/[0.06]" : "border-b border-gray-100 dark:border-white/[0.03]"
                        } ${row.bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"} border-gray-200 dark:border-white/[0.06]`}
                      >
                        {isHeader ? "" : row.isPercent
                          ? (() => {
                              const revYTD = ytd("total_revenue");
                              if (row.key === "gross_margin_pct") return revYTD ? `${((ytd("gross_profit") / revYTD) * 100).toFixed(1)}%` : "—";
                              if (row.key === "operating_margin_pct") return revYTD ? `${((ytd("operating_income") / revYTD) * 100).toFixed(1)}%` : "—";
                              return "—";
                            })()
                          : fmtCurrency(ytd(row.key))
                        }
                      </td>
                      {/* Full Year */}
                      <td
                        className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap border-l ${
                          row.blankAfter ? "border-b-2 border-gray-200 dark:border-white/[0.06]" : "border-b border-gray-100 dark:border-white/[0.03]"
                        } ${row.bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"} border-gray-200 dark:border-white/[0.06]`}
                      >
                        {isHeader ? "" : row.isPercent
                          ? (() => {
                              const revFY = fullYear("total_revenue");
                              if (row.key === "gross_margin_pct") return revFY ? `${((fullYear("gross_profit") / revFY) * 100).toFixed(1)}%` : "—";
                              if (row.key === "operating_margin_pct") return revFY ? `${((fullYear("operating_income") / revFY) * 100).toFixed(1)}%` : "—";
                              return "—";
                            })()
                          : fmtCurrency(fullYear(row.key))
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
            Jan–Jul Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-amber-500" />
            Aug–Dec 8+4 Forecast
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-red-500" />
            Negative values in (parentheses)
          </span>
        </div>
      </div>
    </main>
  );
}
