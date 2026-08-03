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
  { label: "Current", min: 0, max: 0, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
  { label: "1–30", min: 1, max: 30, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
  { label: "31–60", min: 31, max: 60, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
  { label: "61–90", min: 61, max: 90, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800" },
  { label: "90+", min: 91, max: Infinity, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
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

type SortField = "customer" | "totalBalance" | "oldestDue" | "invoiceCount";
type SortDir = "asc" | "desc";

type ConnectedRealm = { realm_id: string; connected_at: string };

const AR_COMPANIES = [
  { id: "1223699155", label: "RedTeam" },
  { id: "791016560", label: "PASKR" },
] as const;

const REALM_LABELS: Record<string, string> = Object.fromEntries(
  AR_COMPANIES.map((c) => [c.id, c.label])
);

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

function realmLabel(realmId: string): string {
  return REALM_LABELS[realmId] || `Company ${realmId.slice(-6)}`;
}

type CachedRealm = { realm_id: string; realm_label: string | null; synced_at: string };

export default function ArAgingPage() {
  const [qboConnected, setQboConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rows, setRows] = useState<ArRow[]>([]);
  const [reportDate, setReportDate] = useState<string>("");
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("totalBalance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterBucket, setFilterBucket] = useState<number | null>(null);
  const [realms, setRealms] = useState<ConnectedRealm[]>([]);
  const [cachedRealms, setCachedRealms] = useState<CachedRealm[]>([]);
  const [selectedRealm, setSelectedRealm] = useState<string>("");

  useEffect(() => {
    fetch("/api/qbo/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.realms?.length) {
          setRealms(data.realms);
        }
      });
  }, [qboConnected]);

  async function loadCachedData(realmId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ar?realmId=${realmId}`);
      const data = await res.json();
      setRows(data.rows || []);
      setReportDate(data.reportDate || "");
      setSyncedAt(data.synced_at || null);
      if (data.cachedRealms) setCachedRealms(data.cachedRealms);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedRealm(AR_COMPANIES[0].id);
  }, []);

  useEffect(() => {
    if (selectedRealm) loadCachedData(selectedRealm);
  }, [selectedRealm]);

  async function syncFromQbo() {
    if (!selectedRealm) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/ar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realmId: selectedRealm,
          realmLabel: realmLabel(selectedRealm),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      const data = await res.json();
      setRows(data.rows);
      setReportDate(data.reportDate);
      setSyncedAt(data.synced_at);
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
  const pastDueCustomers = customers.filter((c) => c.oldestDue > 0).length;

  const filtered =
    filterBucket !== null
      ? customers.filter((c) => c.bucketAmounts[filterBucket] > 0)
      : customers;

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "customer") return mul * a.customer.localeCompare(b.customer);
    return mul * (a[sortField] - b[sortField]);
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
    <main className="ml-[220px] min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-8">
      <div className="max-w-[1400px] mx-auto">
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

        {/* Company Toggle + Sync Controls */}
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/[0.1] overflow-hidden">
            {AR_COMPANIES.map((company) => (
              <button
                key={company.id}
                onClick={() => setSelectedRealm(company.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedRealm === company.id
                    ? "bg-[#EF373E] text-white"
                    : "bg-white dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.08]"
                }`}
              >
                {company.label}
              </button>
            ))}
          </div>
          {qboConnected && selectedRealm && (
            <button
              onClick={syncFromQbo}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white/[0.1] hover:bg-gray-800 dark:hover:bg-white/[0.15] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
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
                  Sync {AR_COMPANIES.find((c) => c.id === selectedRealm)?.label}
                </>
              )}
            </button>
          )}
          {syncedAt && (
            <span className="text-xs text-gray-400">
              Last synced: {new Date(syncedAt).toLocaleString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-[#EF373E] rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-4">Loading AR data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
            {qboConnected && (
              <button
                onClick={syncFromQbo}
                className="mt-3 text-sm text-red-500 hover:text-red-700 underline"
              >
                Retry sync
              </button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <p className="text-gray-400 text-lg font-medium">
              No AR aging data available
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {qboConnected
                ? "Click \"Sync from QBO\" to pull the latest aged receivables."
                : "An admin with QBO access needs to sync this data first."}
            </p>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Report as of{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {new Date(reportDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {" · "}
                {customers.length} customers · {rows.length} open invoices
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                  Total AR
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {fmt(totalAr)}
                </p>
              </div>
              <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                  Past Due
                </p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${totalPastDue > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                  {fmt(totalPastDue)}
                </p>
                {totalAr > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {((totalPastDue / totalAr) * 100).toFixed(1)}% of total AR
                  </p>
                )}
              </div>
              <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                  Customers Past Due
                </p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${pastDueCustomers > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
                  {pastDueCustomers}
                  <span className="text-sm font-normal text-gray-500">
                    {" "}/ {customers.length}
                  </span>
                </p>
              </div>
            </div>

            {/* Aging Buckets */}
            <div className="grid grid-cols-5 gap-3 mb-8">
              {BUCKETS.map((bucket, i) => (
                <button
                  key={bucket.label}
                  onClick={() =>
                    setFilterBucket(filterBucket === i ? null : i)
                  }
                  className={`rounded-xl border p-4 text-left transition-all ${
                    filterBucket === i
                      ? bucket.bgColor + " ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 dark:ring-offset-[#0a0a0a]"
                      : filterBucket !== null
                        ? "bg-white/50 dark:bg-white/[0.02] border-gray-100 dark:border-white/[0.04] opacity-50"
                        : "bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]"
                  }`}
                >
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                    {bucket.label} days
                  </p>
                  <p className={`text-lg font-bold mt-1 tabular-nums ${bucketTotals[i] > 0 ? bucket.color : "text-gray-400 dark:text-gray-600"}`}>
                    {fmt(bucketTotals[i])}
                  </p>
                </button>
              ))}
            </div>

            {/* AR bar */}
            {totalAr > 0 && (
              <div className="mb-8">
                <div className="flex h-3 rounded-full overflow-hidden">
                  {bucketTotals.map((amount, i) => {
                    const pct = (amount / totalAr) * 100;
                    if (pct < 0.5) return null;
                    const colors = [
                      "bg-emerald-500",
                      "bg-blue-500",
                      "bg-amber-500",
                      "bg-orange-500",
                      "bg-red-500",
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
                <div className="flex mt-1.5 gap-4">
                  {bucketTotals.map((amount, i) => {
                    const pct = (amount / totalAr) * 100;
                    if (pct < 1) return null;
                    return (
                      <p key={i} className="text-[10px] text-gray-500">
                        <span className={BUCKETS[i].color}>{BUCKETS[i].label}</span>{" "}
                        {pct.toFixed(0)}%
                      </p>
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
                        className="py-3 px-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Customer{sortArrow("customer")}
                      </th>
                      <th
                        onClick={() => toggleSort("invoiceCount")}
                        className="py-3 px-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Invoices{sortArrow("invoiceCount")}
                      </th>
                      {BUCKETS.map((b) => (
                        <th
                          key={b.label}
                          className="py-3 px-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {b.label}
                        </th>
                      ))}
                      <th
                        onClick={() => toggleSort("totalBalance")}
                        className="py-3 px-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Total{sortArrow("totalBalance")}
                      </th>
                      <th
                        onClick={() => toggleSort("oldestDue")}
                        className="py-3 px-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
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
                            <td className="py-2.5 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                              <span className="inline-flex items-center gap-2">
                                <svg
                                  className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                {c.customer}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400">
                              {c.invoiceCount}
                            </td>
                            {c.bucketAmounts.map((amt, i) => (
                              <td
                                key={i}
                                className={`py-2.5 px-4 text-sm text-right tabular-nums ${
                                  amt > 0
                                    ? BUCKETS[i].color + " font-medium"
                                    : "text-gray-300 dark:text-gray-700"
                                }`}
                              >
                                {amt > 0 ? fmt(amt) : "–"}
                              </td>
                            ))}
                            <td className="py-2.5 px-4 text-sm text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                              {fmt(c.totalBalance)}
                            </td>
                            <td className={`py-2.5 px-4 text-sm text-right tabular-nums font-medium ${hasOld ? "text-red-600 dark:text-red-400" : c.oldestDue > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
                              {c.oldestDue > 0 ? `${c.oldestDue}d` : "Current"}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td
                                colSpan={9}
                                className="bg-gray-50 dark:bg-white/[0.02] px-4 pb-3"
                              >
                                <table className="w-full mt-1">
                                  <thead>
                                    <tr>
                                      <th className="py-1.5 px-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Type
                                      </th>
                                      <th className="py-1.5 px-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Number
                                      </th>
                                      <th className="py-1.5 px-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Date
                                      </th>
                                      <th className="py-1.5 px-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Due Date
                                      </th>
                                      <th className="py-1.5 px-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Amount
                                      </th>
                                      <th className="py-1.5 px-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Balance
                                      </th>
                                      <th className="py-1.5 px-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Days Past Due
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
                                            <td className="py-1.5 px-3 text-xs text-gray-600 dark:text-gray-400">
                                              {r.transaction_type}
                                            </td>
                                            <td className="py-1.5 px-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                                              {r.num || "–"}
                                            </td>
                                            <td className="py-1.5 px-3 text-xs text-gray-600 dark:text-gray-400">
                                              {r.transaction_date}
                                            </td>
                                            <td className="py-1.5 px-3 text-xs text-gray-600 dark:text-gray-400">
                                              {r.due_date}
                                            </td>
                                            <td className="py-1.5 px-3 text-xs text-right tabular-nums text-gray-600 dark:text-gray-400">
                                              {fmtFull(r.amount)}
                                            </td>
                                            <td className="py-1.5 px-3 text-xs text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                                              {fmtFull(r.open_balance)}
                                            </td>
                                            <td className={`py-1.5 px-3 text-xs text-right tabular-nums font-medium ${bucket.color}`}>
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
    </main>
  );
}

