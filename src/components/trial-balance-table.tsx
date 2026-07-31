"use client";

import type { TrialBalanceRow } from "@/lib/types";
import { VarianceFlag, classifyVariance } from "./variance-flag";

function fmt(n: number): string {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number | null): string {
  if (n === null) return "New";
  if (!isFinite(n)) return "New";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

type VarianceRowData = {
  account_name: string;
  account_type: string;
  current_debit: number;
  current_credit: number;
  current_net: number;
  prior_net: number | null;
  variance_amount: number | null;
  variance_pct: number | null;
  flag: "normal" | "warning" | "alert" | "zero_expected";
};

function buildVarianceRows(
  currentRows: TrialBalanceRow[],
  priorRows: TrialBalanceRow[]
): VarianceRowData[] {
  const priorMap = new Map<string, TrialBalanceRow>();
  for (const r of priorRows) {
    priorMap.set(r.account_name, r);
  }

  return currentRows.map((r) => {
    const prior = priorMap.get(r.account_name);
    const priorNet = prior ? prior.net_amount : null;
    const varianceAmount = priorNet !== null ? r.net_amount - priorNet : null;
    const variancePct =
      priorNet !== null && priorNet !== 0
        ? ((r.net_amount - priorNet) / Math.abs(priorNet)) * 100
        : priorNet === 0 && r.net_amount !== 0
        ? null
        : null;

    return {
      account_name: r.account_name,
      account_type: r.account_type,
      current_debit: r.debit,
      current_credit: r.credit,
      current_net: r.net_amount,
      prior_net: priorNet,
      variance_amount: varianceAmount,
      variance_pct: variancePct,
      flag: classifyVariance(r.account_name, variancePct),
    };
  });
}

function groupByType(rows: VarianceRowData[]): Map<string, VarianceRowData[]> {
  const groups = new Map<string, VarianceRowData[]>();
  for (const r of rows) {
    const existing = groups.get(r.account_type) || [];
    existing.push(r);
    groups.set(r.account_type, existing);
  }
  return groups;
}

export function TrialBalanceTable({
  currentRows,
  priorRows,
  currentMonth,
  priorMonth,
}: {
  currentRows: TrialBalanceRow[];
  priorRows: TrialBalanceRow[];
  currentMonth: string;
  priorMonth: string | null;
}) {
  const varianceRows = buildVarianceRows(currentRows, priorRows);
  const groups = groupByType(varianceRows);
  const hasPrior = priorRows.length > 0;

  const totalDebit = currentRows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = currentRows.reduce((s, r) => s + r.credit, 0);

  const anomalyCount = varianceRows.filter((r) => r.flag !== "normal").length;

  return (
    <div>
      {anomalyCount > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"} detected
          </span>
          <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
            Accounts flagged for large variances or unexpected balances
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium text-right">Debit</th>
              <th className="px-4 py-3 font-medium text-right">Credit</th>
              <th className="px-4 py-3 font-medium text-right">Net ({currentMonth})</th>
              {hasPrior && (
                <>
                  <th className="px-4 py-3 font-medium text-right">
                    Net ({priorMonth})
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Variance $
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Variance %
                  </th>
                </>
              )}
              <th className="px-4 py-3 font-medium text-center">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from(groups.entries()).map(([type, rows]) => (
              <GroupSection
                key={type}
                type={type}
                rows={rows}
                hasPrior={hasPrior}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-800 font-bold text-sm">
              <td className="px-4 py-3 text-gray-900 dark:text-white">
                Total
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {fmt(totalDebit)}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {fmt(totalCredit)}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {fmt(totalDebit - totalCredit)}
              </td>
              {hasPrior && (
                <>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </>
              )}
              <td className="px-4 py-3"></td>
            </tr>
            {Math.abs(totalDebit - totalCredit) > 0.01 && (
              <tr>
                <td
                  colSpan={hasPrior ? 8 : 5}
                  className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                >
                  Trial balance is out of balance by {fmt(Math.abs(totalDebit - totalCredit))}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function GroupSection({
  type,
  rows,
  hasPrior,
}: {
  type: string;
  rows: VarianceRowData[];
  hasPrior: boolean;
}) {
  const groupNet = rows.reduce((s, r) => s + r.current_net, 0);

  return (
    <>
      <tr className="bg-gray-50/50 dark:bg-gray-800/50">
        <td
          colSpan={hasPrior ? 8 : 5}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300"
        >
          {type}
          <span className="ml-2 font-normal text-gray-400">
            ({rows.length} accounts, Net: {fmt(groupNet)})
          </span>
        </td>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.account_name}
          className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
            row.flag !== "normal"
              ? "bg-yellow-50/30 dark:bg-yellow-900/10"
              : ""
          }`}
        >
          <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
            {row.account_name}
          </td>
          <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300 tabular-nums">
            {fmt(row.current_debit)}
          </td>
          <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300 tabular-nums">
            {fmt(row.current_credit)}
          </td>
          <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white tabular-nums">
            {fmt(row.current_net)}
          </td>
          {hasPrior && (
            <>
              <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                {row.prior_net !== null ? fmt(row.prior_net) : "—"}
              </td>
              <td
                className={`px-4 py-2 text-right tabular-nums ${
                  row.variance_amount !== null && row.variance_amount > 0
                    ? "text-red-600 dark:text-red-400"
                    : row.variance_amount !== null && row.variance_amount < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-400"
                }`}
              >
                {row.variance_amount !== null ? fmt(row.variance_amount) : "—"}
              </td>
              <td
                className={`px-4 py-2 text-right text-xs tabular-nums ${
                  row.variance_pct !== null && Math.abs(row.variance_pct) >= 20
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {row.variance_pct !== null ? fmtPct(row.variance_pct) : "—"}
              </td>
            </>
          )}
          <td className="px-4 py-2 text-center">
            <VarianceFlag flag={row.flag} />
          </td>
        </tr>
      ))}
    </>
  );
}
