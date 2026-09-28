"use client";

import { useState, useEffect, useCallback } from "react";

type Invoice = {
  customer: string;
  invoiceNumber: string;
  txnDate: string;
  dueDate: string;
  balance: number;
  totalAmt: number;
};

type CustomerGroup = {
  customer: string;
  owner: string;
  status: "Active" | "Churned";
  totalOutstanding: number;
  mostRecentDate: string;
  invoices: Invoice[];
};

type Entity = "flex" | "go" | "cb-flex";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string): string {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonth(d: string): string {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const [entity, setEntity] = useState<Entity>("flex");
  const [customers, setCustomers] = useState<CustomerGroup[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async (ent: Entity) => {
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    try {
      const res = await fetch(`/api/invoices?entity=${ent}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotalOutstanding(data.totalOutstanding || 0);
      setCustomerCount(data.customerCount || 0);
      setInvoiceCount(data.invoiceCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(entity);
  }, [entity, fetchData]);

  const toggleExpand = (customer: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(customer)) next.delete(customer);
      else next.add(customer);
      return next;
    });
  };

  const filtered = search
    ? customers.filter((c) =>
        c.customer.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Outstanding Invoices
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Open invoices by customer
          </p>
        </div>

        {/* Entity toggle */}
        <div className="flex items-center gap-2 mb-6">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-white/[0.04] p-0.5">
            <button
              onClick={() => setEntity("flex")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                entity === "flex"
                  ? "bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              RedTeam Flex
            </button>
            <button
              onClick={() => setEntity("go")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                entity === "go"
                  ? "bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              RedTeam Go
            </button>
            <button
              onClick={() => setEntity("cb-flex")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                entity === "cb-flex"
                  ? "bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Chargebee Flex
            </button>
          </div>

          <div className="ml-auto">
            <button
              onClick={() => fetchData(entity)}
              disabled={loading}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              )}
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Total Outstanding
              </div>
              <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(totalOutstanding)}
              </div>
            </div>
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Customers
              </div>
              <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {customerCount}
              </div>
            </div>
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Open Invoices
              </div>
              <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {invoiceCount}
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#EF373E]/30 focus:border-[#EF373E]/50"
          />
        </div>

        {/* Customer list */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <div className="text-gray-400 dark:text-gray-500 text-sm">
              {search ? "No customers match your search" : "No outstanding invoices"}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.04]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-8" />
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Owner
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Active
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Most Recent
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Outstanding
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Invoices
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => {
                  const isOpen = expanded.has(group.customer);
                  return (
                    <CustomerRow
                      key={group.customer}
                      group={group}
                      isOpen={isOpen}
                      onToggle={() => toggleExpand(group.customer)}
                    />
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.02]">
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Total ({filtered.length} customers)
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(filtered.reduce((s, c) => s + c.totalOutstanding, 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {filtered.reduce((s, c) => s + c.invoices.length, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function CustomerRow({
  group,
  isOpen,
  onToggle,
}: {
  group: CustomerGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
      >
        <td className="pl-5 py-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </td>
        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
          {group.customer}
        </td>
        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
          {group.owner || "—"}
        </td>
        <td className="px-5 py-3 text-center">
          <span
            className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
              group.status === "Active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {group.status === "Active" ? "Active" : "Churn"}
          </span>
        </td>
        <td className="px-5 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
          {formatMonth(group.mostRecentDate)}
        </td>
        <td className="px-5 py-3 text-right tabular-nums text-gray-900 dark:text-white">
          {formatCurrency(group.totalOutstanding)}
        </td>
        <td className="px-5 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
          {group.invoices.length}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-gray-50/50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/[0.04]">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th className="text-left px-5 py-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Invoice #
                    </th>
                    <th className="text-left px-5 py-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="text-left px-5 py-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Due Date
                    </th>
                    <th className="text-right px-5 py-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Total
                    </th>
                    <th className="text-right px-5 py-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.invoices.map((inv) => {
                    const isPastDue =
                      inv.dueDate && new Date(inv.dueDate + "T00:00:00") < new Date();
                    return (
                      <tr
                        key={inv.invoiceNumber || inv.txnDate}
                        className="border-t border-gray-100/50 dark:border-white/[0.02]"
                      >
                        <td className="w-8" />
                        <td className="px-5 py-2 text-gray-700 dark:text-gray-300">
                          {inv.invoiceNumber || "—"}
                        </td>
                        <td className="px-5 py-2 text-gray-500 dark:text-gray-400">
                          {formatDate(inv.txnDate)}
                        </td>
                        <td
                          className={`px-5 py-2 ${
                            isPastDue
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                          {formatCurrency(inv.totalAmt)}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-gray-900 dark:text-white font-medium">
                          {formatCurrency(inv.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
