"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PnLLineItems = {
  revenue: { total: number; accounts: { name: string; amount: number }[] };
  cogs: { total: number; accounts: { name: string; amount: number }[] };
  gross_profit: number;
  gross_margin_pct: number;
  opex: { total: number; accounts: { name: string; amount: number }[] };
  ebitda: number;
  depreciation: number;
  interest: number;
  taxes: number;
  net_income: number;
};

type BSSection = {
  name: string;
  total: number;
  accounts: { name: string; amount: number }[];
};

type BSLineItems = {
  assets: { total: number; sections: BSSection[] };
  liabilities: { total: number; sections: BSSection[] };
  equity: { total: number; sections: BSSection[] };
  total_liabilities_equity: number;
};

type MonthData = {
  line_items: PnLLineItems | BSLineItems;
  raw_sections: { section: string; total: number; accounts: { name: string; amount: number }[] }[];
  synced_at: string;
};

type DealMetrics = {
  quarter: string;
  new_business_arr: number;
  new_business_count: number;
  expansion_arr: number;
  expansion_count: number;
  renewal_arr: number;
  renewal_count: number;
  churned_arr: number;
  churned_count: number;
  total_closed_arr: number;
  total_closed_count: number;
};

type FinancialData = {
  pnl: Record<string, MonthData>;
  bs: Record<string, MonthData>;
  dealMetrics: DealMetrics[];
  months: string[];
};

type TabId = "month-is" | "ytd-is" | "balance-sheet" | "arr-rollforward";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RT_RED = "#EF373E";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function varianceColor(v: number, inverted = false): string {
  const favorable = inverted ? v < 0 : v > 0;
  if (v === 0) return "text-gray-400 dark:text-gray-500";
  return favorable
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function getPriorYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${parseInt(y) - 1}-${m}`;
}

function getMonthsInRange(startYm: string, endYm: string): string[] {
  const result: string[] = [];
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function getYtdMonths(ym: string): string[] {
  const [y] = ym.split("-");
  return getMonthsInRange(`${y}-01`, ym);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Tab Definitions
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: "month-is", label: "Income Statement" },
  { id: "ytd-is", label: "YTD Summary" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "arr-rollforward", label: "ARR Rollforward" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SyncControls({
  selectedMonth,
  setSelectedMonth,
  onSync,
  syncing,
  lastSynced,
}: {
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  onSync: () => void;
  syncing: boolean;
  lastSynced: string | null;
}) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
      >
        {months.map((m) => (
          <option key={m} value={m}>{monthLabel(m)}</option>
        ))}
      </select>
      <button
        onClick={onSync}
        disabled={syncing}
        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: RT_RED }}
      >
        {syncing ? "Syncing..." : "Sync from QBO"}
      </button>
      {lastSynced && (
        <span className="text-xs text-gray-400">
          Last synced: {new Date(lastSynced).toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Income Statement — Month View
// ---------------------------------------------------------------------------

function IncomeStatementRow({
  label,
  current,
  prior,
  isBold = false,
  isSubtotal = false,
  indent = 0,
  invertVariance = false,
}: {
  label: string;
  current: number;
  prior: number | null;
  isBold?: boolean;
  isSubtotal?: boolean;
  indent?: number;
  invertVariance?: boolean;
}) {
  const variance = prior !== null ? current - prior : null;
  const variancePct = prior !== null && prior !== 0 ? (current - prior) / Math.abs(prior) : null;

  return (
    <tr className={`${isSubtotal ? "border-t border-gray-200 dark:border-gray-700" : ""} ${isBold ? "font-semibold" : ""}`}>
      <td className={`py-1.5 pr-4 text-sm text-gray-900 dark:text-gray-100`} style={{ paddingLeft: `${indent * 20 + 12}px` }}>
        {label}
      </td>
      <td className="py-1.5 px-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
        {fmt(current)}
      </td>
      <td className="py-1.5 px-3 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400">
        {prior !== null ? fmt(prior) : "—"}
      </td>
      <td className={`py-1.5 px-3 text-sm text-right tabular-nums ${variance !== null ? varianceColor(variance, invertVariance) : ""}`}>
        {variance !== null ? `${variance >= 0 ? "" : "("}${fmt(Math.abs(variance))}${variance < 0 ? ")" : ""}` : "—"}
      </td>
      <td className={`py-1.5 px-3 text-sm text-right tabular-nums ${variancePct !== null ? varianceColor(variancePct, invertVariance) : ""}`}>
        {variancePct !== null ? `${(variancePct * 100).toFixed(1)}%` : "—"}
      </td>
    </tr>
  );
}

function MonthIncomeStatement({
  data,
  selectedMonth,
}: {
  data: FinancialData;
  selectedMonth: string;
}) {
  const currentData = data.pnl[selectedMonth]?.line_items as PnLLineItems | undefined;
  const priorMonth = getPriorYearMonth(selectedMonth);
  const priorData = data.pnl[priorMonth]?.line_items as PnLLineItems | undefined;

  if (!currentData) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">No data for {monthLabel(selectedMonth)}</p>
        <p className="text-sm mt-2">Use &ldquo;Sync from QBO&rdquo; to pull financial data for this month.</p>
      </div>
    );
  }

  const p = priorData;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[40%]">
              Account
            </th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {monthLabel(selectedMonth)}
            </th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {monthLabel(priorMonth)}
            </th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              $ Var
            </th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              % Var
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Revenue */}
          <tr><td colSpan={5} className="pt-4 pb-1 px-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Revenue</td></tr>
          {currentData.revenue.accounts.map((acct, i) => (
            <IncomeStatementRow
              key={`rev-${i}`}
              label={acct.name}
              current={acct.amount}
              prior={p?.revenue.accounts.find((a) => a.name === acct.name)?.amount ?? null}
              indent={1}
            />
          ))}
          <IncomeStatementRow label="Total Revenue" current={currentData.revenue.total} prior={p?.revenue.total ?? null} isBold isSubtotal />

          {/* COGS */}
          <tr><td colSpan={5} className="pt-4 pb-1 px-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost of Goods Sold</td></tr>
          {currentData.cogs.accounts.map((acct, i) => (
            <IncomeStatementRow
              key={`cogs-${i}`}
              label={acct.name}
              current={acct.amount}
              prior={p?.cogs.accounts.find((a) => a.name === acct.name)?.amount ?? null}
              indent={1}
              invertVariance
            />
          ))}
          <IncomeStatementRow label="Total COGS" current={currentData.cogs.total} prior={p?.cogs.total ?? null} isBold isSubtotal invertVariance />

          {/* Gross Profit */}
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <td colSpan={5} className="h-1" />
          </tr>
          <IncomeStatementRow label="Gross Profit" current={currentData.gross_profit} prior={p?.gross_profit ?? null} isBold isSubtotal />
          <tr>
            <td className="py-1 px-3 text-sm text-gray-500 dark:text-gray-400 italic" style={{ paddingLeft: "32px" }}>Gross Margin</td>
            <td className="py-1 px-3 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400 italic">{fmtPct(currentData.gross_margin_pct)}</td>
            <td className="py-1 px-3 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400 italic">
              {p ? fmtPct(p.gross_margin_pct) : "—"}
            </td>
            <td colSpan={2} />
          </tr>

          {/* Operating Expenses */}
          <tr><td colSpan={5} className="pt-4 pb-1 px-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operating Expenses</td></tr>
          {currentData.opex.accounts.map((acct, i) => (
            <IncomeStatementRow
              key={`opex-${i}`}
              label={acct.name}
              current={Math.abs(acct.amount)}
              prior={p?.opex.accounts.find((a) => a.name === acct.name) ? Math.abs(p.opex.accounts.find((a) => a.name === acct.name)!.amount) : null}
              indent={1}
              invertVariance
            />
          ))}
          <IncomeStatementRow label="Total OpEx" current={currentData.opex.total} prior={p?.opex.total ?? null} isBold isSubtotal invertVariance />

          {/* EBITDA & Bottom Line */}
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <td colSpan={5} className="h-1" />
          </tr>
          <IncomeStatementRow label="EBITDA" current={currentData.ebitda} prior={p?.ebitda ?? null} isBold isSubtotal />
          <IncomeStatementRow label="Depreciation & Amortization" current={currentData.depreciation} prior={p?.depreciation ?? null} indent={1} invertVariance />
          <IncomeStatementRow label="Interest" current={currentData.interest} prior={p?.interest ?? null} indent={1} invertVariance />
          <IncomeStatementRow label="Taxes" current={currentData.taxes} prior={p?.taxes ?? null} indent={1} invertVariance />

          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <td colSpan={5} className="h-1" />
          </tr>
          <IncomeStatementRow label="Net Income" current={currentData.net_income} prior={p?.net_income ?? null} isBold isSubtotal />
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// YTD Income Statement
// ---------------------------------------------------------------------------

function YtdIncomeStatement({
  data,
  selectedMonth,
}: {
  data: FinancialData;
  selectedMonth: string;
}) {
  const ytdMonths = getYtdMonths(selectedMonth);
  const availableMonths = ytdMonths.filter((m) => data.pnl[m]);

  if (availableMonths.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">No YTD data available</p>
        <p className="text-sm mt-2">Sync monthly data from QBO to see the YTD summary.</p>
      </div>
    );
  }

  function sumField(months: string[], accessor: (li: PnLLineItems) => number): number {
    return months.reduce((sum, m) => {
      const li = data.pnl[m]?.line_items as PnLLineItems | undefined;
      return sum + (li ? accessor(li) : 0);
    }, 0);
  }

  const rows: { label: string; isBold?: boolean; isSubtotal?: boolean; indent?: number; invertVariance?: boolean; accessor: (li: PnLLineItems) => number }[] = [
    { label: "Total Revenue", isBold: true, accessor: (li) => li.revenue.total },
    { label: "Total COGS", isBold: true, invertVariance: true, accessor: (li) => li.cogs.total },
    { label: "Gross Profit", isBold: true, isSubtotal: true, accessor: (li) => li.gross_profit },
    { label: "Total OpEx", isBold: true, invertVariance: true, accessor: (li) => li.opex.total },
    { label: "EBITDA", isBold: true, isSubtotal: true, accessor: (li) => li.ebitda },
    { label: "D&A", indent: 1, invertVariance: true, accessor: (li) => li.depreciation },
    { label: "Interest", indent: 1, invertVariance: true, accessor: (li) => li.interest },
    { label: "Taxes", indent: 1, invertVariance: true, accessor: (li) => li.taxes },
    { label: "Net Income", isBold: true, isSubtotal: true, accessor: (li) => li.net_income },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-white dark:bg-[#1a1b23] z-10 min-w-[140px]">
              Line Item
            </th>
            {ytdMonths.map((m) => (
              <th key={m} className={`py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px] ${data.pnl[m] ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"}`}>
                {monthLabel(m)}
              </th>
            ))}
            <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 min-w-[110px]">
              YTD Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const ytdTotal = sumField(availableMonths, row.accessor);
            return (
              <tr key={idx} className={`${row.isSubtotal ? "border-t border-gray-200 dark:border-gray-700" : ""} ${row.isBold ? "font-semibold" : ""}`}>
                <td className="py-1.5 pr-4 text-sm text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-[#1a1b23] z-10" style={{ paddingLeft: `${(row.indent || 0) * 20 + 12}px` }}>
                  {row.label}
                </td>
                {ytdMonths.map((m) => {
                  const li = data.pnl[m]?.line_items as PnLLineItems | undefined;
                  const val = li ? row.accessor(li) : null;
                  return (
                    <td key={m} className={`py-1.5 px-3 text-sm text-right tabular-nums ${val !== null ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
                      {val !== null ? fmt(val) : "—"}
                    </td>
                  );
                })}
                <td className="py-1.5 px-3 text-sm text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800/50">
                  {fmt(ytdTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

function BalanceSheetView({
  data,
  selectedMonth,
}: {
  data: FinancialData;
  selectedMonth: string;
}) {
  const ytdMonths = getYtdMonths(selectedMonth);
  const availableMonths = ytdMonths.filter((m) => data.bs[m]);

  if (availableMonths.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">No Balance Sheet data available</p>
        <p className="text-sm mt-2">Sync monthly data from QBO to see the Balance Sheet.</p>
      </div>
    );
  }

  function getBs(m: string): BSLineItems | null {
    return (data.bs[m]?.line_items as BSLineItems) ?? null;
  }

  function findSectionTotal(bs: BSLineItems | null, category: "assets" | "liabilities" | "equity", sectionName: string): number | null {
    if (!bs) return null;
    const sec = bs[category].sections.find((s) => s.name.toLowerCase().includes(sectionName.toLowerCase()));
    return sec ? sec.total : null;
  }

  function findAccountAmount(bs: BSLineItems | null, category: "assets" | "liabilities" | "equity", accountName: string): number | null {
    if (!bs) return null;
    for (const sec of bs[category].sections) {
      const acct = sec.accounts.find((a) => a.name.toLowerCase().includes(accountName.toLowerCase()));
      if (acct) return acct.amount;
    }
    return null;
  }

  type BSRow = {
    label: string;
    accessor: (bs: BSLineItems | null) => number | null;
    isBold?: boolean;
    isSubtotal?: boolean;
    indent?: number;
    isSpacer?: boolean;
  };

  const rows: BSRow[] = [
    { label: "ASSETS", isBold: true, isSpacer: true, accessor: () => null },
    { label: "Cash", indent: 1, accessor: (bs) => {
      if (!bs) return null;
      for (const sec of bs.assets.sections) {
        for (const a of sec.accounts) {
          if (a.name.toLowerCase().includes("checking") || a.name.toLowerCase().includes("savings") || a.name.toLowerCase().includes("cash")) return a.amount;
        }
      }
      return null;
    }},
    { label: "Accounts Receivable", indent: 1, accessor: (bs) => {
      if (!bs) return null;
      for (const sec of bs.assets.sections) {
        if (sec.name.toLowerCase().includes("current assets") && sec.total > 0) return sec.total;
      }
      return null;
    }},
    { label: "Other Current Assets", indent: 1, accessor: (bs) => findSectionTotal(bs, "assets", "other current") },
    { label: "Fixed Assets (net)", indent: 1, accessor: (bs) => findSectionTotal(bs, "assets", "fixed") },
    { label: "Other Assets", indent: 1, accessor: (bs) => findSectionTotal(bs, "assets", "other assets") },
    { label: "Total Assets", isBold: true, isSubtotal: true, accessor: (bs) => bs?.assets.total ?? null },
    { label: "", isSpacer: true, accessor: () => null },
    { label: "LIABILITIES", isBold: true, isSpacer: true, accessor: () => null },
    { label: "Accounts Payable", indent: 1, accessor: (bs) => {
      if (!bs) return null;
      for (const sec of bs.liabilities.sections) {
        if (sec.name.toLowerCase().includes("current liabilities") && sec.total > 0) return sec.total;
      }
      return null;
    }},
    { label: "Other Current Liabilities", indent: 1, accessor: (bs) => findSectionTotal(bs, "liabilities", "other current") },
    { label: "Deferred Revenue", indent: 1, accessor: (bs) => findAccountAmount(bs, "liabilities", "deferred revenue") },
    { label: "Long-Term Liabilities", indent: 1, accessor: (bs) => findSectionTotal(bs, "liabilities", "long-term") },
    { label: "Total Liabilities", isBold: true, isSubtotal: true, accessor: (bs) => bs?.liabilities.total ?? null },
    { label: "", isSpacer: true, accessor: () => null },
    { label: "EQUITY", isBold: true, isSpacer: true, accessor: () => null },
    { label: "Total Equity", isBold: true, isSubtotal: true, accessor: (bs) => bs?.equity.total ?? null },
    { label: "", isSpacer: true, accessor: () => null },
    { label: "Total Liabilities & Equity", isBold: true, isSubtotal: true, accessor: (bs) => bs?.total_liabilities_equity ?? null },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-white dark:bg-[#1a1b23] z-10 min-w-[180px]">
              Account
            </th>
            {ytdMonths.map((m) => (
              <th key={m} className={`py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px] ${data.bs[m] ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"}`}>
                {monthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.isSpacer && !row.label) {
              return <tr key={idx}><td colSpan={ytdMonths.length + 1} className="h-3" /></tr>;
            }
            if (row.isSpacer) {
              return (
                <tr key={idx}>
                  <td colSpan={ytdMonths.length + 1} className="pt-3 pb-1 px-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-white dark:bg-[#1a1b23]">
                    {row.label}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={idx} className={`${row.isSubtotal ? "border-t border-gray-200 dark:border-gray-700" : ""} ${row.isBold ? "font-semibold" : ""}`}>
                <td className="py-1.5 pr-4 text-sm text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-[#1a1b23] z-10" style={{ paddingLeft: `${(row.indent || 0) * 20 + 12}px` }}>
                  {row.label}
                </td>
                {ytdMonths.map((m) => {
                  const bs = getBs(m);
                  const val = row.accessor(bs);
                  return (
                    <td key={m} className={`py-1.5 px-3 text-sm text-right tabular-nums ${val !== null ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
                      {val !== null ? fmt(val) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ARR Rollforward
// ---------------------------------------------------------------------------

function ArrRollforward({
  data,
}: {
  data: FinancialData;
}) {
  const metrics = data.dealMetrics;

  if (!metrics || metrics.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">No deal metrics available</p>
        <p className="text-sm mt-2">Sync HubSpot data to see the ARR rollforward.</p>
      </div>
    );
  }

  const sorted = [...metrics].sort((a, b) => a.quarter.localeCompare(b.quarter));

  // Seed: ARR book value at the start of the earliest quarter in the dataset
  const BEGINNING_ARR_SEED = 7_500_000;

  let runningArr = BEGINNING_ARR_SEED;
  const quarterRows = sorted.map((q, i) => {
    const beginningArr = runningArr;
    const newBiz = q.new_business_arr || 0;
    const expansion = q.expansion_arr || 0;
    const churn = -(Math.abs(q.churned_arr || 0));
    const netNew = newBiz + expansion + churn;
    const endingArr = beginningArr + netNew;
    runningArr = endingArr;

    const renewal = q.renewal_arr || 0;
    const expiring = renewal + Math.abs(churn);
    const nrr = expiring > 0 ? ((renewal + expansion) / expiring) * 100 : null;
    const grr = expiring > 0 ? (renewal / expiring) * 100 : null;

    return {
      quarter: q.quarter,
      beginningArr,
      newBiz,
      expansion,
      churn,
      netNew,
      endingArr,
      nrr,
      grr,
      newLogos: q.new_business_count || 0,
      churnedLogos: q.churned_count || 0,
    };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[22%]">Metric</th>
            {quarterRows.map((q) => (
              <th key={q.quarter} className="py-2 px-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {q.quarter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <td className="py-1.5 px-3 text-sm text-gray-900 dark:text-gray-100">Beginning ARR</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">{fmtK(q.beginningArr)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 text-sm text-emerald-600 dark:text-emerald-400" style={{ paddingLeft: "24px" }}>(+) New Business</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtK(q.newBiz)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 text-sm text-blue-600 dark:text-blue-400" style={{ paddingLeft: "24px" }}>(+) Expansion</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtK(q.expansion)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 text-sm text-red-600 dark:text-red-400" style={{ paddingLeft: "24px" }}>(-) Churn</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-red-600 dark:text-red-400">{fmtK(q.churn)}</td>
            ))}
          </tr>
          <tr className="border-t border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800/50">
            <td className="py-2 px-3 text-sm text-gray-900 dark:text-gray-100">Ending ARR</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-2 px-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">{fmtK(q.endingArr)}</td>
            ))}
          </tr>

          <tr><td colSpan={quarterRows.length + 1} className="h-3" /></tr>

          <tr>
            <td className="py-1.5 px-3 text-sm text-gray-600 dark:text-gray-400">Net New ARR</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className={`py-1.5 px-3 text-sm text-right tabular-nums ${varianceColor(q.netNew)}`}>{fmtK(q.netNew)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 px-3 text-sm text-gray-600 dark:text-gray-400">NRR %</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                {q.nrr !== null ? `${q.nrr.toFixed(1)}%` : "—"}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 px-3 text-sm text-gray-600 dark:text-gray-400">GRR %</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                {q.grr !== null ? `${q.grr.toFixed(1)}%` : "—"}
              </td>
            ))}
          </tr>

          <tr><td colSpan={quarterRows.length + 1} className="h-3" /></tr>

          <tr>
            <td className="py-1.5 px-3 text-sm text-gray-600 dark:text-gray-400">New Logos</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">{q.newLogos}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 px-3 text-sm text-gray-600 dark:text-gray-400">Churned Logos</td>
            {quarterRows.map((q) => (
              <td key={q.quarter} className="py-1.5 px-3 text-sm text-right tabular-nums text-red-600 dark:text-red-400">{q.churnedLogos > 0 ? `(${q.churnedLogos})` : "0"}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

import React from "react";

export default function FinancialsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("month-is");
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getPreviousMonth(getCurrentYearMonth()));
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/financials/data?entity=RTS");
      if (!res.ok) throw new Error("Failed to fetch financial data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/financials/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth: selectedMonth, entity: "RTS" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Sync failed");
      }
      await fetchData();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const lastSynced = data?.pnl[selectedMonth]?.synced_at || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: RT_RED }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Financial Statements
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live data from QuickBooks Online &amp; HubSpot
          </p>
        </div>
        <SyncControls
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          onSync={handleSync}
          syncing={syncing}
          lastSynced={lastSynced}
        />
      </div>

      {syncError && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {syncError}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#EF373E] text-gray-900 dark:text-gray-100"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-[#1a1b23] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        {activeTab === "month-is" && data && (
          <MonthIncomeStatement data={data} selectedMonth={selectedMonth} />
        )}
        {activeTab === "ytd-is" && data && (
          <YtdIncomeStatement data={data} selectedMonth={selectedMonth} />
        )}
        {activeTab === "balance-sheet" && data && (
          <BalanceSheetView data={data} selectedMonth={selectedMonth} />
        )}
        {activeTab === "arr-rollforward" && data && (
          <ArrRollforward data={data} />
        )}
      </div>

      {/* Available months indicator */}
      {data && data.months.length > 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Synced months: {data.months.map((m) => monthLabel(m)).join(", ")}
        </div>
      )}
    </div>
  );
}
