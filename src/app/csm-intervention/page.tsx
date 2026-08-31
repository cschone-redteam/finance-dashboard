"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

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
  "fieldlens",
  "field lens",
];

function isIntercompany(customer: string): boolean {
  const lower = customer.toLowerCase();
  return INTERCOMPANY_PATTERNS.some((p) => lower.includes(p));
}

type CustomerIntervention = {
  customer: string;
  entity: string;
  totalBalance: number;
  invoiceCount: number;
  oldestDays: number;
  oldestDueDate: string;
  invoices: ArRow[];
};

type SortField = "customer" | "entity" | "totalBalance" | "oldestDays" | "invoiceCount";
type SortDir = "asc" | "desc";

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

function severityColor(days: number): string {
  if (days > 120) return "text-red-700 dark:text-red-300";
  if (days > 90) return "text-red-500 dark:text-red-400";
  if (days > 60) return "text-orange-600 dark:text-orange-400";
  return "text-amber-600 dark:text-amber-400";
}

function severityBg(days: number): string {
  if (days > 120) return "bg-red-100 dark:bg-red-950/60";
  if (days > 90) return "bg-red-50 dark:bg-red-950/40";
  if (days > 60) return "bg-orange-50 dark:bg-orange-950/40";
  return "bg-amber-50 dark:bg-amber-950/40";
}

function severityLabel(days: number): string {
  if (days > 120) return "Critical";
  if (days > 90) return "High";
  if (days > 60) return "Medium";
  return "Low";
}

export default function CsmInterventionPage() {
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<{ entity: string; rows: ArRow[] }[]>([]);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("oldestDays");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results: { entity: string; rows: ArRow[] }[] = [];
      await Promise.all(
        AR_COMPANIES.map(async (co) => {
          try {
            const res = await fetch(`/api/ar?realmId=${co.id}`);
            const data = await res.json();
            results.push({ entity: co.label, rows: data.rows || [] });
          } catch {
            results.push({ entity: co.label, rows: [] });
          }
        }),
      );
      setAllRows(results);
      setLoading(false);
    }
    load();
  }, []);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerIntervention>();

    for (const { entity, rows } of allRows) {
      for (const row of rows) {
        if (row.days_past_due <= 45) continue;
        if (row.open_balance <= 0) continue;
        if (isIntercompany(row.customer)) continue;

        const key = `${row.customer}::${entity}`;
        let entry = map.get(key);
        if (!entry) {
          entry = {
            customer: row.customer,
            entity,
            totalBalance: 0,
            invoiceCount: 0,
            oldestDays: 0,
            oldestDueDate: "",
            invoices: [],
          };
          map.set(key, entry);
        }
        entry.totalBalance += row.open_balance;
        entry.invoiceCount++;
        if (row.days_past_due > entry.oldestDays) {
          entry.oldestDays = row.days_past_due;
          entry.oldestDueDate = row.due_date;
        }
        entry.invoices.push(row);
      }
    }

    return [...map.values()];
  }, [allRows]);

  const filtered = useMemo(() => {
    let list = customers;
    if (entityFilter) list = list.filter((c) => c.entity === entityFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.customer.toLowerCase().includes(q));
    }
    const mul = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortField) {
        case "customer": return mul * a.customer.localeCompare(b.customer);
        case "entity": return mul * a.entity.localeCompare(b.entity);
        case "totalBalance": return mul * (a.totalBalance - b.totalBalance);
        case "oldestDays": return mul * (a.oldestDays - b.oldestDays);
        case "invoiceCount": return mul * (a.invoiceCount - b.invoiceCount);
      }
    });
  }, [customers, entityFilter, search, sortField, sortDir]);

  const totalBalance = filtered.reduce((s, c) => s + c.totalBalance, 0);
  const criticalCount = filtered.filter((c) => c.oldestDays > 90).length;

  const handleExport = useCallback(() => {
    const sheetData = filtered.map((c) => ({
      Customer: c.customer,
      Entity: c.entity,
      "Open Balance": c.totalBalance,
      Invoices: c.invoiceCount,
      "Oldest (Days)": c.oldestDays,
      Severity: severityLabel(c.oldestDays),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "CSM Intervention");
    XLSX.writeFile(wb, `csm-intervention-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filtered]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            CSM Intervention
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Customers with AR aging over 45 days requiring CSM follow-up
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading AR data...</div>
        ) : customers.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <p className="text-gray-400 text-sm font-medium">No customers with aging over 45 days</p>
            <p className="text-xs text-gray-400 mt-1">Sync AR data from the AR Aging page first</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-6">
              <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Customers</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">{filtered.length}</div>
              </div>
              <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Outstanding</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5 font-mono">{fmt(totalBalance)}</div>
              </div>
              <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Critical (90+ days)</div>
                <div className="text-lg font-semibold text-red-600 dark:text-red-400 mt-0.5">{criticalCount}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 w-64 outline-none focus:ring-1 focus:ring-[#EF373E]/50"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setEntityFilter(null)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    entityFilter === null
                      ? "bg-gray-900 dark:bg-white/[0.1] text-white"
                      : "bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06]"
                  }`}
                >
                  All
                </button>
                {AR_COMPANIES.map((co) => (
                  <button
                    key={co.id}
                    onClick={() => setEntityFilter(co.label)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      entityFilter === co.label
                        ? "bg-gray-900 dark:bg-white/[0.1] text-white"
                        : "bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06]"
                    }`}
                  >
                    {co.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="ml-auto px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export XLSX
              </button>
              <span className="text-xs text-gray-400">{filtered.length} customers</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
                    {[
                      { key: "customer" as SortField, label: "Customer", align: "text-left" },
                      { key: "entity" as SortField, label: "Entity", align: "text-left" },
                      { key: "totalBalance" as SortField, label: "Balance", align: "text-right" },
                      { key: "invoiceCount" as SortField, label: "Invoices", align: "text-right" },
                      { key: "oldestDays" as SortField, label: "Oldest", align: "text-right" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap select-none ${col.align}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortField === col.key && (
                            <span className="text-[#EF373E]">{sortDir === "asc" ? "↑" : "↓"}</span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {filtered.map((c) => {
                    const key = `${c.customer}::${c.entity}`;
                    const isExpanded = expandedCustomer === key;
                    return (
                      <tr key={key} className="group">
                        <td colSpan={6} className="p-0">
                          <div
                            className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                            onClick={() => setExpandedCustomer(isExpanded ? null : key)}
                          >
                            <div className="px-3 py-2.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-gray-900 dark:text-white font-medium truncate">{c.customer}</span>
                              </div>
                            </div>
                            <div className="px-3 py-2.5 w-24">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                c.entity === "RedTeam"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                              }`}>
                                {c.entity}
                              </span>
                            </div>
                            <div className="px-3 py-2.5 w-28 text-right font-mono text-gray-700 dark:text-gray-300">
                              {fmt(c.totalBalance)}
                            </div>
                            <div className="px-3 py-2.5 w-20 text-right text-gray-600 dark:text-gray-400">
                              {c.invoiceCount}
                            </div>
                            <div className={`px-3 py-2.5 w-24 text-right font-mono font-semibold ${severityColor(c.oldestDays)}`}>
                              {c.oldestDays}d
                            </div>
                            <div className="px-3 py-2.5 w-24">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${severityBg(c.oldestDays)} ${severityColor(c.oldestDays)}`}>
                                {severityLabel(c.oldestDays)}
                              </span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-8 pb-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 dark:text-gray-500">
                                    <th className="text-left py-1.5 font-medium">Invoice #</th>
                                    <th className="text-left py-1.5 font-medium">Type</th>
                                    <th className="text-left py-1.5 font-medium">Date</th>
                                    <th className="text-left py-1.5 font-medium">Due Date</th>
                                    <th className="text-right py-1.5 font-medium">Amount</th>
                                    <th className="text-right py-1.5 font-medium">Balance</th>
                                    <th className="text-right py-1.5 font-medium">Days</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                                  {c.invoices
                                    .sort((a, b) => b.days_past_due - a.days_past_due)
                                    .map((inv, i) => (
                                    <tr key={i} className="text-gray-600 dark:text-gray-400">
                                      <td className="py-1.5">{inv.num || "—"}</td>
                                      <td className="py-1.5">{inv.transaction_type}</td>
                                      <td className="py-1.5">{inv.transaction_date}</td>
                                      <td className="py-1.5">{inv.due_date}</td>
                                      <td className="py-1.5 text-right font-mono">{fmtFull(inv.amount)}</td>
                                      <td className="py-1.5 text-right font-mono">{fmtFull(inv.open_balance)}</td>
                                      <td className={`py-1.5 text-right font-mono font-semibold ${severityColor(inv.days_past_due)}`}>
                                        {inv.days_past_due}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
