"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

type LineComparison = {
  product: string;
  pandadocPrice: number | null;
  chargebeePrice: number | null;
  priceVariance: number;
  pandadocFrequency: string;
  chargebeeFrequency: string;
  frequencyMatch: boolean;
};

type ContractComparison = {
  company: string;
  pandadocContract: string | null;
  pandadocTcv: number | null;
  pandadocBillingFrequency: string;
  pandadocPricingPlan: string;
  pandadocStartDate: string;
  pandadocRenewalDate: string;
  chargebeeSubscriptionId: string | null;
  chargebeeAmount: number | null;
  chargebeeBillingFrequency: string;
  chargebeeTermStart: string;
  chargebeeTermEnd: string;
  chargebeeMrr: number;
  amountVariance: number;
  billingFrequencyMatch: boolean;
  lineComparisons: LineComparison[];
  status: "match" | "variance" | "pandadoc-only" | "chargebee-only";
};

type Stats = {
  total: number;
  matches: number;
  variances: number;
  pandadocOnly: number;
  chargebeeOnly: number;
  totalVarianceAmount: number;
};

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

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  match: {
    label: "Match",
    classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  variance: {
    label: "Variance",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  "pandadoc-only": {
    label: "PandaDoc Only",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "chargebee-only": {
    label: "Chargebee Only",
    classes: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

export default function ContractAuditPage() {
  const [comparisons, setComparisons] = useState<ContractComparison[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contract-audit");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setComparisons(data.comparisons || []);
      setStats(data.stats || null);
      setSyncedAt(new Date());
      if (data.errors?.length) {
        setError(data.errors.join("; "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setComparisons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = comparisons;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.company.toLowerCase().includes(q));
    }
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [comparisons, search, statusFilter]);

  const handleExport = useCallback(() => {
    const rows = filtered.map((c) => ({
      Company: c.company,
      Status: STATUS_LABELS[c.status]?.label || c.status,
      "PandaDoc Contract": c.pandadocContract || "",
      "PandaDoc TCV": c.pandadocTcv,
      "PandaDoc Billing": c.pandadocBillingFrequency,
      "PandaDoc Plan": c.pandadocPricingPlan,
      "PandaDoc Start": c.pandadocStartDate,
      "PandaDoc Renewal": c.pandadocRenewalDate,
      "Chargebee Sub ID": c.chargebeeSubscriptionId || "",
      "Chargebee Amount": c.chargebeeAmount,
      "Chargebee Billing": c.chargebeeBillingFrequency,
      "Chargebee Term Start": c.chargebeeTermStart,
      "Chargebee Term End": c.chargebeeTermEnd,
      "Chargebee MRR": c.chargebeeMrr,
      "Annual Variance": c.amountVariance,
      "Billing Match": c.billingFrequencyMatch ? "Yes" : "No",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Contract Audit");
    XLSX.writeFile(
      wb,
      `contract-audit-${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  }, [filtered]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Contract Audit
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Chargebee subscriptions vs PandaDoc contracts &mdash; PandaDoc is
            the standard
          </p>
        </div>

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="ml-auto flex items-center gap-3">
            {syncedAt && !loading && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Loaded{" "}
                {syncedAt.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                  />
                </svg>
              )}
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-sm text-amber-700 dark:text-amber-400">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {!loading && stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Total Companies
              </div>
              <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats.total}
              </div>
            </div>
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                Matches
              </div>
              <div className="mt-1.5 text-2xl font-bold text-green-700 dark:text-green-400 tabular-nums">
                {stats.matches}
              </div>
            </div>
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Variances
              </div>
              <div className="mt-1.5 text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {stats.variances}
              </div>
            </div>
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                PandaDoc Only
              </div>
              <div className="mt-1.5 text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {stats.pandadocOnly}
              </div>
            </div>
            <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
              <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Chargebee Only
              </div>
              <div className="mt-1.5 text-2xl font-bold text-purple-700 dark:text-purple-400 tabular-nums">
                {stats.chargebeeOnly}
              </div>
            </div>
          </div>
        )}

        {/* Total variance callout */}
        {!loading && stats && stats.totalVarianceAmount > 0 && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <div>
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Total Annual Variance:{" "}
                  {formatCurrency(stats.totalVarianceAmount)}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Sum of absolute differences across all companies with
                  variances
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Company name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#EF373E]/30 focus:border-[#EF373E]/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF373E]/30 focus:border-[#EF373E]/50"
            >
              <option value="">All Statuses</option>
              <option value="variance">Variance</option>
              <option value="match">Match</option>
              <option value="pandadoc-only">PandaDoc Only</option>
              <option value="chargebee-only">Chargebee Only</option>
            </select>
          </div>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter("")}
              className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
            className="ml-auto px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Export XLSX
          </button>
        </div>

        {/* Comparison table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            Loading contracts and subscriptions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <div className="text-gray-400 dark:text-gray-500 text-sm">
              {search || statusFilter
                ? "No companies match your filters"
                : "No data loaded"}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.04]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-8" />
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    PandaDoc
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Billing
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Chargebee
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Billing
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                    <ComparisonRow
                      key={idx}
                      comparison={c}
                      isOpen={expanded.has(idx)}
                      onToggle={() => toggleExpand(idx)}
                    />
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.02]">
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Total ({filtered.length} companies)
                  </td>
                  <td />
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(
                      filtered.reduce(
                        (s, c) => s + (c.pandadocTcv || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td />
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(
                      filtered.reduce(
                        (s, c) => s + (c.chargebeeAmount || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td />
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(
                      filtered.reduce(
                        (s, c) => s + Math.abs(c.amountVariance),
                        0,
                      ),
                    )}
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

function ComparisonRow({
  comparison: c,
  isOpen,
  onToggle,
}: {
  comparison: ContractComparison;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const statusInfo = STATUS_LABELS[c.status] || {
    label: c.status,
    classes: "",
  };
  const hasDetails =
    c.lineComparisons.length > 0 ||
    c.pandadocContract ||
    c.chargebeeSubscriptionId;

  return (
    <>
      <tr
        onClick={hasDetails ? onToggle : undefined}
        className={`border-b border-gray-50 dark:border-white/[0.03] transition-colors ${
          hasDetails
            ? "hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer"
            : ""
        }`}
      >
        <td className="pl-5 py-3">
          {hasDetails && (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          )}
        </td>
        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
          {c.company}
        </td>
        <td className="px-5 py-3 text-center">
          <span
            className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${statusInfo.classes}`}
          >
            {statusInfo.label}
          </span>
        </td>
        <td className="px-5 py-3 text-right tabular-nums text-gray-900 dark:text-white">
          {c.pandadocTcv !== null ? formatCurrency(c.pandadocTcv) : "—"}
        </td>
        <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
          {c.pandadocBillingFrequency || "—"}
        </td>
        <td className="px-5 py-3 text-right tabular-nums text-gray-900 dark:text-white">
          {c.chargebeeAmount !== null
            ? formatCurrency(c.chargebeeAmount)
            : "—"}
        </td>
        <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
          {c.chargebeeBillingFrequency || "—"}
        </td>
        <td
          className={`px-5 py-3 text-right tabular-nums font-medium ${
            c.amountVariance === 0
              ? "text-gray-400 dark:text-gray-500"
              : c.amountVariance > 0
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {c.status === "pandadoc-only" || c.status === "chargebee-only"
            ? "—"
            : c.amountVariance === 0
              ? "—"
              : (c.amountVariance > 0 ? "+" : "") +
                formatCurrency(c.amountVariance)}
        </td>
      </tr>
      {isOpen && hasDetails && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-gray-50/50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/[0.04] px-8 py-4">
              {/* Contract details */}
              <div className="grid grid-cols-2 gap-6 mb-4">
                {c.pandadocContract && (
                  <div>
                    <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                      PandaDoc Contract
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div>{c.pandadocContract}</div>
                      <div>Plan: {c.pandadocPricingPlan || "—"}</div>
                      <div>
                        Term: {formatDate(c.pandadocStartDate)} &rarr;{" "}
                        {formatDate(c.pandadocRenewalDate)}
                      </div>
                    </div>
                  </div>
                )}
                {c.chargebeeSubscriptionId && (
                  <div>
                    <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                      Chargebee Subscription
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div>ID: {c.chargebeeSubscriptionId}</div>
                      <div>MRR: {formatCurrency(c.chargebeeMrr)}</div>
                      <div>
                        Term: {formatDate(c.chargebeeTermStart)} &rarr;{" "}
                        {formatDate(c.chargebeeTermEnd)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Line item comparisons */}
              {c.lineComparisons.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    Line Item Comparison
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 pr-4 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          Product
                        </th>
                        <th className="text-right py-1.5 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          PandaDoc
                        </th>
                        <th className="text-right py-1.5 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          Chargebee
                        </th>
                        <th className="text-right py-1.5 pl-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          Variance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.lineComparisons.map((line, i) => (
                        <tr
                          key={i}
                          className="border-t border-gray-100/50 dark:border-white/[0.02]"
                        >
                          <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                            {line.product}
                          </td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {line.pandadocPrice !== null
                              ? formatCurrency(line.pandadocPrice)
                              : "—"}
                          </td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {line.chargebeePrice !== null
                              ? formatCurrency(line.chargebeePrice)
                              : "—"}
                          </td>
                          <td
                            className={`py-1.5 pl-3 text-right tabular-nums font-medium ${
                              line.priceVariance === 0
                                ? "text-gray-400"
                                : line.priceVariance > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {line.priceVariance === 0
                              ? "—"
                              : (line.priceVariance > 0 ? "+" : "") +
                                formatCurrency(line.priceVariance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
