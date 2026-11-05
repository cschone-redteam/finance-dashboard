"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

type EntityTotals = { flex: number; go: number; other: number; total: number };
type MonthData = { invoiced: EntityTotals; collected: EntityTotals };
type BillingData = Record<string, MonthData>;

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number): string {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function FYSection({
  year,
  data,
}: {
  year: string;
  data: BillingData;
}) {
  const [expandInvoiced, setExpandInvoiced] = useState(false);
  const [expandCollected, setExpandCollected] = useState(false);

  const monthKeys = MONTHS.map((m) => `${year}-${m}`);

  function sumEntity(type: "invoiced" | "collected", entity: keyof EntityTotals): number {
    return monthKeys.reduce((s, k) => s + (data[k]?.[type]?.[entity] || 0), 0);
  }

  function val(key: string, type: "invoiced" | "collected", entity: keyof EntityTotals): number {
    return data[key]?.[type]?.[entity] || 0;
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        FY{year.slice(2)}
      </h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/[0.04]">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-32 sticky left-0 bg-white dark:bg-[#0d0d0d] z-10" />
              {MONTH_LABELS.map((m) => (
                <th key={m} className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide min-w-[88px]">
                  {m}
                </th>
              ))}
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide min-w-[100px] border-l border-gray-100 dark:border-white/[0.06]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Invoiced */}
            <tr
              onClick={() => setExpandInvoiced(!expandInvoiced)}
              className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
            >
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-[#0d0d0d] z-10">
                <span className="inline-flex items-center gap-2">
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandInvoiced ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Invoiced
                </span>
              </td>
              {monthKeys.map((k) => (
                <td key={k} className="text-right px-3 py-2.5 tabular-nums text-gray-900 dark:text-white">
                  {fmt(val(k, "invoiced", "total"))}
                </td>
              ))}
              <td className="text-right px-4 py-2.5 tabular-nums font-semibold text-gray-900 dark:text-white border-l border-gray-100 dark:border-white/[0.06]">
                {fmt(sumEntity("invoiced", "total"))}
              </td>
            </tr>
            {expandInvoiced && (
              <>
                {(["flex", "go", "other"] as const).map((entity) => {
                  const total = sumEntity("invoiced", entity);
                  if (total === 0 && entity === "other") return null;
                  return (
                    <tr key={entity} className="border-b border-gray-50/50 dark:border-white/[0.02]">
                      <td className="pl-10 pr-4 py-2 text-xs text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-[#0d0d0d] z-10">
                        {entity === "flex" ? "Flex" : entity === "go" ? "Go" : "Other"}
                      </td>
                      {monthKeys.map((k) => (
                        <td key={k} className="text-right px-3 py-2 tabular-nums text-xs text-gray-500 dark:text-gray-400">
                          {fmt(val(k, "invoiced", entity))}
                        </td>
                      ))}
                      <td className="text-right px-4 py-2 tabular-nums text-xs font-medium text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-white/[0.06]">
                        {fmt(total)}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}

            {/* Collected */}
            <tr
              onClick={() => setExpandCollected(!expandCollected)}
              className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
            >
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-[#0d0d0d] z-10">
                <span className="inline-flex items-center gap-2">
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandCollected ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Collected
                </span>
              </td>
              {monthKeys.map((k) => (
                <td key={k} className="text-right px-3 py-2.5 tabular-nums text-gray-900 dark:text-white">
                  {fmt(val(k, "collected", "total"))}
                </td>
              ))}
              <td className="text-right px-4 py-2.5 tabular-nums font-semibold text-gray-900 dark:text-white border-l border-gray-100 dark:border-white/[0.06]">
                {fmt(sumEntity("collected", "total"))}
              </td>
            </tr>
            {expandCollected && (
              <>
                {(["flex", "go", "other"] as const).map((entity) => {
                  const total = sumEntity("collected", entity);
                  if (total === 0 && entity === "other") return null;
                  return (
                    <tr key={entity} className="border-b border-gray-50/50 dark:border-white/[0.02]">
                      <td className="pl-10 pr-4 py-2 text-xs text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-[#0d0d0d] z-10">
                        {entity === "flex" ? "Flex" : entity === "go" ? "Go" : "Other"}
                      </td>
                      {monthKeys.map((k) => (
                        <td key={k} className="text-right px-3 py-2 tabular-nums text-xs text-gray-500 dark:text-gray-400">
                          {fmt(val(k, "collected", entity))}
                        </td>
                      ))}
                      <td className="text-right px-4 py-2 tabular-nums text-xs font-medium text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-white/[0.06]">
                        {fmt(total)}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}

            {/* % Collected */}
            <tr className="border-t border-gray-200 dark:border-white/[0.06]">
              <td className="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 italic sticky left-0 bg-white dark:bg-[#0d0d0d] z-10">
                % Collected
              </td>
              {monthKeys.map((k) => {
                const inv = val(k, "invoiced", "total");
                const col = val(k, "collected", "total");
                const pct = inv > 0 ? (col / inv) * 100 : 0;
                return (
                  <td key={k} className={`text-right px-3 py-2.5 tabular-nums font-medium ${
                    inv === 0 ? "text-gray-300 dark:text-gray-600" :
                    pct >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                    pct >= 90 ? "text-gray-900 dark:text-white" :
                    pct >= 75 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-500 dark:text-red-400"
                  }`}>
                    {inv === 0 ? "—" : `${pct.toFixed(1)}%`}
                  </td>
                );
              })}
              {(() => {
                const totalInv = sumEntity("invoiced", "total");
                const totalCol = sumEntity("collected", "total");
                const totalPct = totalInv > 0 ? (totalCol / totalInv) * 100 : 0;
                return (
                  <td className={`text-right px-4 py-2.5 tabular-nums font-semibold border-l border-gray-100 dark:border-white/[0.06] ${
                    totalInv === 0 ? "text-gray-300 dark:text-gray-600" :
                    totalPct >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                    totalPct >= 90 ? "text-gray-900 dark:text-white" :
                    totalPct >= 75 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-500 dark:text-red-400"
                  }`}>
                    {totalInv === 0 ? "—" : `${totalPct.toFixed(1)}%`}
                  </td>
                );
              })()}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCached = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing");
      const json = await res.json();
      setData(json.data);
      setSyncedAt(json.synced_at);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/billing", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setData(json.data);
      setSyncedAt(json.synced_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, []);

  const summaryCards = useMemo(() => {
    if (!data) return null;
    const fy25Invoiced = MONTHS.reduce((s, m) => s + (data[`2025-${m}`]?.invoiced?.total || 0), 0);
    const fy25Collected = MONTHS.reduce((s, m) => s + (data[`2025-${m}`]?.collected?.total || 0), 0);
    const fy26Invoiced = MONTHS.reduce((s, m) => s + (data[`2026-${m}`]?.invoiced?.total || 0), 0);
    const fy26Collected = MONTHS.reduce((s, m) => s + (data[`2026-${m}`]?.collected?.total || 0), 0);
    return { fy25Invoiced, fy25Collected, fy26Invoiced, fy26Collected };
  }, [data]);

  const handleExport = useCallback(() => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    for (const year of ["2025", "2026"]) {
      const rows: Record<string, string | number>[] = [];
      const monthKeys = MONTHS.map((m) => `${year}-${m}`);

      for (const type of ["invoiced", "collected"] as const) {
        const totalRow: Record<string, string | number> = { "": `${type === "invoiced" ? "Invoiced" : "Collected"}` };
        const flexRow: Record<string, string | number> = { "": "  Flex" };
        const goRow: Record<string, string | number> = { "": "  Go" };
        const otherRow: Record<string, string | number> = { "": "  Other" };
        let totalSum = 0, flexSum = 0, goSum = 0, otherSum = 0;

        monthKeys.forEach((k, i) => {
          const label = MONTH_LABELS[i];
          const m = data[k]?.[type];
          totalRow[label] = m?.total || 0;
          flexRow[label] = m?.flex || 0;
          goRow[label] = m?.go || 0;
          otherRow[label] = m?.other || 0;
          totalSum += m?.total || 0;
          flexSum += m?.flex || 0;
          goSum += m?.go || 0;
          otherSum += m?.other || 0;
        });

        totalRow["Total"] = totalSum;
        flexRow["Total"] = flexSum;
        goRow["Total"] = goSum;
        otherRow["Total"] = otherSum;

        rows.push(totalRow, flexRow, goRow, otherRow);
      }

      const pctRow: Record<string, string | number> = { "": "% Collected" };
      let invSum = 0, colSum = 0;
      monthKeys.forEach((k, i) => {
        const inv = data[k]?.invoiced?.total || 0;
        const col = data[k]?.collected?.total || 0;
        invSum += inv;
        colSum += col;
        pctRow[MONTH_LABELS[i]] = inv > 0 ? Math.round((col / inv) * 1000) / 10 / 100 : 0;
      });
      pctRow["Total"] = invSum > 0 ? Math.round((colSum / invSum) * 1000) / 10 / 100 : 0;
      rows.push(pctRow);

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `FY${year.slice(2)}`);
    }
    XLSX.writeFile(wb, `billing-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [data]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Billing
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Monthly invoiced and collected amounts by entity
            </p>
          </div>
          <div className="flex items-center gap-3">
            {syncedAt && !loading && !syncing && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Last synced {new Date(syncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            {data && (
              <button
                onClick={handleExport}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
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
              {syncing ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading billing data...</div>
        ) : !data ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <p className="text-gray-400 text-sm font-medium">No billing data cached</p>
            <p className="text-xs text-gray-400 mt-1">Click Sync to pull invoice and payment data from QuickBooks</p>
          </div>
        ) : (
          <>
            {summaryCards && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">FY25 Invoiced</div>
                  <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{fmt(summaryCards.fy25Invoiced)}</div>
                </div>
                <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">FY25 Collected</div>
                  <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{fmt(summaryCards.fy25Collected)}</div>
                </div>
                <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">FY26 Invoiced</div>
                  <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{fmt(summaryCards.fy26Invoiced)}</div>
                </div>
                <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">FY26 Collected</div>
                  <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{fmt(summaryCards.fy26Collected)}</div>
                </div>
              </div>
            )}

            <FYSection year="2025" data={data} />
            <FYSection year="2026" data={data} />
          </>
        )}
      </div>
    </main>
  );
}
