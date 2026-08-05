"use client";

import { useEffect, useState } from "react";
import { QboConnect } from "@/components/qbo-connect";

type CashForecastMonth = {
  month: string;
  vendorPayments: number;
  payroll: number;
  fourOneK: number;
  groupHealth: number;
  ramp: number;
  contractorPayments: number;
  cashReceipts: number;
};

const AR_COMPANIES = [
  { id: "1223699155", label: "RedTeam" },
  { id: "791016560", label: "PASKR" },
] as const;

const OUTFLOW_ROWS = [
  { key: "vendorPayments" as const, label: "Vendor Payments" },
  { key: "payroll" as const, label: "Payroll" },
  { key: "fourOneK" as const, label: "401k" },
  { key: "groupHealth" as const, label: "Group Health" },
  { key: "ramp" as const, label: "Ramp" },
  { key: "contractorPayments" as const, label: "Contractor Payments" },
];

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${year}`;
}

function CompanyForecastPanel({
  companyId,
  companyLabel,
  qboConnected,
}: {
  companyId: string;
  companyLabel: string;
  qboConnected: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [months, setMonths] = useState<CashForecastMonth[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cash-forecast?realmId=${companyId}`);
        const data = await res.json();
        setMonths(data.months || []);
        setSyncedAt(data.synced_at || null);
      } catch {
        setMonths([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  async function syncFromQbo() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/cash-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realmId: companyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      const data = await res.json();
      setMonths(data.months || []);
      setSyncedAt(data.synced_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  }

  const totalOutflows = months.map((m) =>
    OUTFLOW_ROWS.reduce((sum, r) => sum + m[r.key], 0)
  );
  const netCash = months.map((m, i) => m.cashReceipts - totalOutflows[i]);

  return (
    <div>
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {companyLabel}
          </h2>
          {syncedAt && (
            <span className="text-[11px] text-gray-400">
              Synced {new Date(syncedAt).toLocaleString()}
            </span>
          )}
        </div>
        {qboConnected && (
          <button
            onClick={syncFromQbo}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 dark:bg-white/[0.1] hover:bg-gray-800 dark:hover:bg-white/[0.15] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {syncing ? (
              <>
                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M21.015 4.356v4.992" />
                </svg>
                Sync
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-[#EF373E] rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-3">Loading...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          {qboConnected && (
            <button onClick={syncFromQbo} className="mt-2 text-xs text-red-500 hover:text-red-700 underline">
              Retry sync
            </button>
          )}
        </div>
      ) : months.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-400 text-sm font-medium">No cash forecast data</p>
          <p className="text-xs text-gray-400 mt-1">
            {qboConnected
              ? "Click Sync to pull cash flow data from QBO."
              : "An admin needs to sync this data first."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                  <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-white dark:bg-[#0a0a0a] z-10">
                    Category
                  </th>
                  {months.map((m) => (
                    <th
                      key={m.month}
                      className="py-2.5 px-4 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {monthLabel(m.month)}
                    </th>
                  ))}
                  <th className="py-2.5 px-4 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Outflow section header */}
                <tr>
                  <td
                    colSpan={months.length + 2}
                    className="py-2 px-4 text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-white/[0.02]"
                  >
                    Cash Outflows
                  </td>
                </tr>

                {OUTFLOW_ROWS.map((row) => {
                  const rowTotal = months.reduce((sum, m) => sum + m[row.key], 0);
                  return (
                    <tr key={row.key} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="py-2 px-4 text-xs font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-white dark:bg-[#0a0a0a]">
                        {row.label}
                      </td>
                      {months.map((m) => (
                        <td
                          key={m.month}
                          className={`py-2 px-4 text-xs text-right tabular-nums ${
                            m[row.key] > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-300 dark:text-gray-700"
                          }`}
                        >
                          {m[row.key] > 0 ? fmt(m[row.key]) : "–"}
                        </td>
                      ))}
                      <td className={`py-2 px-4 text-xs text-right tabular-nums font-semibold ${rowTotal > 0 ? "text-red-600 dark:text-red-400" : "text-gray-300 dark:text-gray-700"}`}>
                        {rowTotal > 0 ? fmt(rowTotal) : "–"}
                      </td>
                    </tr>
                  );
                })}

                {/* Total Outflows */}
                <tr className="border-b-2 border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.02]">
                  <td className="py-2 px-4 text-xs font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-white/[0.02]">
                    Total Outflows
                  </td>
                  {totalOutflows.map((total, i) => (
                    <td key={months[i].month} className="py-2 px-4 text-xs text-right tabular-nums font-bold text-red-600 dark:text-red-400">
                      {total > 0 ? fmt(total) : "–"}
                    </td>
                  ))}
                  <td className="py-2 px-4 text-xs text-right tabular-nums font-bold text-red-600 dark:text-red-400">
                    {fmt(totalOutflows.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>

                {/* Cash Receipts section */}
                <tr>
                  <td
                    colSpan={months.length + 2}
                    className="py-2 px-4 text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-white/[0.02]"
                  >
                    Cash Inflows
                  </td>
                </tr>

                <tr className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="py-2 px-4 text-xs font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-white dark:bg-[#0a0a0a]">
                    Cash Receipts
                  </td>
                  {months.map((m) => (
                    <td
                      key={m.month}
                      className={`py-2 px-4 text-xs text-right tabular-nums ${
                        m.cashReceipts > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-300 dark:text-gray-700"
                      }`}
                    >
                      {m.cashReceipts > 0 ? fmt(m.cashReceipts) : "–"}
                    </td>
                  ))}
                  <td className={`py-2 px-4 text-xs text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400`}>
                    {fmt(months.reduce((sum, m) => sum + m.cashReceipts, 0))}
                  </td>
                </tr>

                {/* Net Cash Flow */}
                <tr className="bg-gray-50 dark:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-xs font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-white/[0.02]">
                    Net Cash Flow
                  </td>
                  {netCash.map((net, i) => (
                    <td
                      key={months[i].month}
                      className={`py-2.5 px-4 text-xs text-right tabular-nums font-bold ${
                        net >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {fmt(net)}
                    </td>
                  ))}
                  <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-bold ${
                    netCash.reduce((a, b) => a + b, 0) >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {fmt(netCash.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CashForecastPage() {
  const [qboConnected, setQboConnected] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Cash Forecast
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Monthly cash outflows and receipts from QuickBooks Online
            </p>
          </div>
          <QboConnect onStatusChange={setQboConnected} />
        </div>

        {/* Side-by-side company panels */}
        <div className="grid grid-cols-2 gap-8">
          {AR_COMPANIES.map((company) => (
            <CompanyForecastPanel
              key={company.id}
              companyId={company.id}
              companyLabel={company.label}
              qboConnected={qboConnected}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
