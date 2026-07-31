"use client";

import type { HsRevenueSummary, TrialBalanceRow } from "@/lib/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function RevenueReconciliation({
  tbRows,
  hsRevenue,
  yearMonth,
}: {
  tbRows: TrialBalanceRow[];
  hsRevenue: HsRevenueSummary | null;
  yearMonth: string;
}) {
  const revenueAccounts = tbRows.filter((r) =>
    r.account_type.toLowerCase().includes("income") ||
    r.account_type.toLowerCase().includes("revenue")
  );
  const qboRevenue = revenueAccounts.reduce(
    (sum, r) => sum + Math.abs(r.net_amount),
    0
  );

  const hsTotal = hsRevenue?.total_revenue ?? 0;
  const diff = qboRevenue - hsTotal;
  const diffPct = hsTotal > 0 ? (diff / hsTotal) * 100 : null;
  const isAligned = diffPct !== null && Math.abs(diffPct) <= 5;

  const [y, m] = yearMonth.split("-");
  const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Revenue Reconciliation — {label}
      </h3>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            QBO Revenue
          </div>
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {fmt(qboRevenue)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {revenueAccounts.length} accounts
          </div>
        </div>

        <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            HubSpot Deals Won
          </div>
          <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
            {hsRevenue ? fmt(hsTotal) : "—"}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {hsRevenue ? `${hsRevenue.deals_won} deals` : "No data"}
          </div>
        </div>

        <div
          className={`text-center p-3 rounded-lg ${
            !hsRevenue
              ? "bg-gray-50 dark:bg-gray-800"
              : isAligned
              ? "bg-green-50 dark:bg-green-900/20"
              : "bg-red-50 dark:bg-red-900/20"
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Difference
          </div>
          <div
            className={`text-lg font-bold ${
              !hsRevenue
                ? "text-gray-400"
                : isAligned
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {hsRevenue ? fmt(diff) : "—"}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {diffPct !== null ? `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%` : ""}
          </div>
        </div>
      </div>

      {hsRevenue && !isAligned && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          Revenue differs by more than 5% between QBO and HubSpot. Check for
          unrecorded invoices, timing differences, or deals not yet invoiced.
        </div>
      )}

      {hsRevenue && isAligned && (
        <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          Revenue is within 5% tolerance between QBO and HubSpot.
        </div>
      )}

      {!hsRevenue && (
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          No HubSpot revenue data for this month. Seed data by clicking &ldquo;Seed
          HubSpot Data&rdquo; above.
        </div>
      )}
    </div>
  );
}
