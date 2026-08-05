"use client";

import { Fragment, useEffect, useState } from "react";
import { QboConnect } from "@/components/qbo-connect";

type ArRow = {
  customer: string;
  transaction_type: string;
  transaction_date: string;
  due_date: string;
  num: string;
  amount: number;
  open_balance: number;
  days_past_due: number;
};

type AgingBucket = {
  label: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
};

const BUCKETS: AgingBucket[] = [
  { label: "Current (1–30)", min: 0, max: 30, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
  { label: "31–60", min: 31, max: 60, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
  { label: "61–90", min: 61, max: 90, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800" },
  { label: "91–120", min: 91, max: 120, color: "text-red-500 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
  { label: "120+", min: 121, max: Infinity, color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-700" },
];

function bucketForDays(days: number): AgingBucket {
  return BUCKETS.find((b) => days >= b.min && days <= b.max) || BUCKETS[4];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type CustomerSummary = {
  customer: string;
  totalBalance: number;
  invoiceCount: number;
  oldestDue: number;
  bucketAmounts: number[];
  rows: ArRow[];
};

function buildCustomerSummaries(rows: ArRow[]): CustomerSummary[] {
  const map = new Map<string, CustomerSummary>();

  for (const row of rows) {
    let summary = map.get(row.customer);
    if (!summary) {
      summary = {
        customer: row.customer,
        totalBalance: 0,
        invoiceCount: 0,
        oldestDue: 0,
        bucketAmounts: [0, 0, 0, 0, 0],
        rows: [],
      };
      map.set(row.customer, summary);
    }
    summary.totalBalance += row.open_balance;
    summary.invoiceCount++;
    summary.oldestDue = Math.max(summary.oldestDue, row.days_past_due);
    summary.rows.push(row);

    const bucketIdx = BUCKETS.findIndex(
      (b) => row.days_past_due >= b.min && row.days_past_due <= b.max
    );
    if (bucketIdx >= 0) summary.bucketAmounts[bucketIdx] += row.open_balance;
  }

  return [...map.values()].sort((a, b) => b.totalBalance - a.totalBalance);
}

type SortField = "customer" | "totalBalance" | "oldestDue" | "invoiceCount" | "bucket0" | "bucket1" | "bucket2" | "bucket3" | "bucket4";
type SortDir = "asc" | "desc";

const AR_COMPANIES = [
  { id: "1223699155", label: "RedTeam" },
  { id: "791016560", label: "PASKR" },
] as const;

const INTERCOMPANY_PATTERNS = [
  "paskr",
  "redteam",
  "red team",
  "rtp consolidated",
  "reserve",
];

function isIntercompany(customer: string): boolean {
  const lower = customer.toLowerCase();
  return INTERCOMPANY_PATTERNS.some((p) => lower.includes(p));
}

function CompanyArPanel({
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
  const [rows, setRows] = useState<ArRow[]>([]);
  const [reportDate, setReportDate] = useState("");
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthlyReceipts, setMonthlyReceipts] = useState(0);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("totalBalance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterBucket, setFilterBucket] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ar?realmId=${companyId}`);
        const data = await res.json();
        setRows(data.rows || []);
        setReportDate(data.reportDate || "");
        setSyncedAt(data.synced_at || null);
        setMonthlyReceipts(data.monthlyReceipts || 0);
      } catch {
        setRows([]);
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
      const res = await fetch("/api/ar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realmId: companyId, realmLabel: companyLabel }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      const data = await res.json();
      setRows(data.rows);
      setReportDate(data.reportDate);
      setSyncedAt(data.synced_at);
      setMonthlyReceipts(data.monthlyReceipts || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync AR data");
    } finally {
      setSyncing(false);
    }
  }

  const customers = buildCustomerSummaries(
    rows.filter((r) => !isIntercompany(r.customer))
  );

  const bucketTotals = BUCKETS.map((_, i) =>
    customers.reduce((sum, c) => sum + c.bucketAmounts[i], 0)
  );
  const totalAr = bucketTotals.reduce((a, b) => a + b, 0);
  const totalPastDue = bucketTotals.slice(1).reduce((a, b) => a + b, 0);

  const filtered =
    filterBucket !== null
      ? customers.filter((c) => c.bucketAmounts[filterBucket] > 0)
      : customers;

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "customer") return mul * a.customer.localeCompare(b.customer);
    const bucketMatch = sortField.match(/^bucket(\d)$/);
    if (bucketMatch) {
      const idx = parseInt(bucketMatch[1]);
      return mul * (a.bucketAmounts[idx] - b.bucketAmounts[idx]);
    }
    return mul * (a[sortField as "totalBalance" | "oldestDue" | "invoiceCount"] - b[sortField as "totalBalance" | "oldestDue" | "invoiceCount"]);
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "customer" ? "asc" : "desc");
    }
  }

  function sortArrow(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

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
            <button
              onClick={syncFromQbo}
              className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
            >
              Retry sync
            </button>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-400 text-sm font-medium">No AR aging data</p>
          <p className="text-xs text-gray-400 mt-1">
            {qboConnected
              ? "Click Sync to pull aged receivables."
              : "An admin needs to sync this data first."}
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
            As of{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {new Date(reportDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {" · "}
            {customers.length} customers · {rows.length} invoices
          </p>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                Total AR
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                {fmt(totalAr)}
              </p>
            </div>
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                Past Due
              </p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${totalPastDue > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                {fmt(totalPastDue)}
              </p>
              {totalAr > 0 && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {((totalPastDue / totalAr) * 100).toFixed(1)}% of total
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                Cash Receipts (MTD)
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {fmt(monthlyReceipts)}
              </p>
              {totalAr > 0 && monthlyReceipts > 0 && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {((monthlyReceipts / (totalAr + monthlyReceipts)) * 100).toFixed(1)}% collected
                </p>
              )}
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="grid grid-cols-5 gap-2 mb-5">
            {BUCKETS.map((bucket, i) => (
              <button
                key={bucket.label}
                onClick={() =>
                  setFilterBucket(filterBucket === i ? null : i)
                }
                className={`rounded-lg border p-2.5 text-left transition-all ${
                  filterBucket === i
                    ? bucket.bgColor + " ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 dark:ring-offset-[#0a0a0a]"
                    : filterBucket !== null
                      ? "bg-white/50 dark:bg-white/[0.02] border-gray-100 dark:border-white/[0.04] opacity-50"
                      : "bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]"
                }`}
              >
                <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                  {bucket.label}
                </p>
                <p className={`text-sm font-bold mt-0.5 tabular-nums ${bucketTotals[i] > 0 ? bucket.color : "text-gray-400 dark:text-gray-600"}`}>
                  {fmt(bucketTotals[i])}
                </p>
              </button>
            ))}
          </div>

          {/* AR Bar */}
          {totalAr > 0 && (
            <div className="mb-5">
              <div className="flex h-2.5 rounded-full overflow-hidden">
                {bucketTotals.map((amount, i) => {
                  const pct = (amount / totalAr) * 100;
                  if (pct < 0.5) return null;
                  const colors = [
                    "bg-emerald-500",
                    "bg-amber-500",
                    "bg-orange-500",
                    "bg-red-500",
                    "bg-red-700",
                  ];
                  return (
                    <div
                      key={i}
                      className={`${colors[i]} first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${pct}%` }}
                      title={`${BUCKETS[i].label}: ${fmt(amount)} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Table */}
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                    <th
                      onClick={() => toggleSort("customer")}
                      className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                    >
                      Customer{sortArrow("customer")}
                    </th>
                    <th
                      onClick={() => toggleSort("invoiceCount")}
                      className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                    >
                      Inv.{sortArrow("invoiceCount")}
                    </th>
                    {BUCKETS.map((b, i) => (
                      <th
                        key={b.label}
                        onClick={() => toggleSort(`bucket${i}` as SortField)}
                        className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                      >
                        {b.label}{sortArrow(`bucket${i}` as SortField)}
                      </th>
                    ))}
                    <th
                      onClick={() => toggleSort("totalBalance")}
                      className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                    >
                      Total{sortArrow("totalBalance")}
                    </th>
                    <th
                      onClick={() => toggleSort("oldestDue")}
                      className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                    >
                      Oldest{sortArrow("oldestDue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const isExpanded = expandedCustomer === c.customer;
                    const hasOld = c.oldestDue > 60;
                    return (
                      <Fragment key={c.customer}>
                        <tr
                          onClick={() =>
                            setExpandedCustomer(
                              isExpanded ? null : c.customer
                            )
                          }
                          className={`border-b border-gray-100 dark:border-white/[0.04] cursor-pointer transition-colors ${
                            isExpanded
                              ? "bg-gray-50 dark:bg-white/[0.03]"
                              : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="py-2 px-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                            <span className="inline-flex items-center gap-1.5">
                              <svg
                                className={`w-2.5 h-2.5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="truncate max-w-[140px]" title={c.customer}>{c.customer}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {c.invoiceCount}
                          </td>
                          {c.bucketAmounts.map((amt, i) => (
                            <td
                              key={i}
                              className={`py-2 px-3 text-xs text-right tabular-nums ${
                                amt > 0
                                  ? BUCKETS[i].color + " font-medium"
                                  : "text-gray-300 dark:text-gray-700"
                              }`}
                            >
                              {amt > 0 ? fmt(amt) : "–"}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-xs text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {fmt(c.totalBalance)}
                          </td>
                          <td className={`py-2 px-3 text-xs text-right tabular-nums font-medium ${hasOld ? "text-red-600 dark:text-red-400" : c.oldestDue > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
                            {c.oldestDue > 0 ? `${c.oldestDue}d` : "Current"}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={9}
                              className="bg-gray-50 dark:bg-white/[0.02] px-3 pb-2"
                            >
                              <table className="w-full mt-1">
                                <thead>
                                  <tr>
                                    <th className="py-1 px-2 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      Type
                                    </th>
                                    <th className="py-1 px-2 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      No.
                                    </th>
                                    <th className="py-1 px-2 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      Date
                                    </th>
                                    <th className="py-1 px-2 text-left text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      Due
                                    </th>
                                    <th className="py-1 px-2 text-right text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      Amount
                                    </th>
                                    <th className="py-1 px-2 text-right text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      Balance
                                    </th>
                                    <th className="py-1 px-2 text-right text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                      Days
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.rows
                                    .sort((a, b) => b.days_past_due - a.days_past_due)
                                    .map((r, ri) => {
                                      const bucket = bucketForDays(r.days_past_due);
                                      return (
                                        <tr
                                          key={ri}
                                          className="border-t border-gray-100 dark:border-white/[0.04]"
                                        >
                                          <td className="py-1 px-2 text-[11px] text-gray-600 dark:text-gray-400">
                                            {r.transaction_type}
                                          </td>
                                          <td className="py-1 px-2 text-[11px] text-gray-600 dark:text-gray-400 font-mono">
                                            {r.num || "–"}
                                          </td>
                                          <td className="py-1 px-2 text-[11px] text-gray-600 dark:text-gray-400">
                                            {r.transaction_date}
                                          </td>
                                          <td className="py-1 px-2 text-[11px] text-gray-600 dark:text-gray-400">
                                            {r.due_date}
                                          </td>
                                          <td className="py-1 px-2 text-[11px] text-right tabular-nums text-gray-600 dark:text-gray-400">
                                            {fmtFull(r.amount)}
                                          </td>
                                          <td className="py-1 px-2 text-[11px] text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                                            {fmtFull(r.open_balance)}
                                          </td>
                                          <td className={`py-1 px-2 text-[11px] text-right tabular-nums font-medium ${bucket.color}`}>
                                            {r.days_past_due > 0
                                              ? `${r.days_past_due}d`
                                              : "Current"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ArAgingPage() {
  const [qboConnected, setQboConnected] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              AR Aging
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Customer invoice aging from QuickBooks Online
            </p>
          </div>
          <QboConnect onStatusChange={setQboConnected} />
        </div>

        {/* Side-by-side company panels */}
        <div className="grid grid-cols-2 gap-8">
          {AR_COMPANIES.map((company) => (
            <CompanyArPanel
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
