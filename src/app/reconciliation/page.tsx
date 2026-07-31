"use client";

import React, { useState } from "react";
import { QUARTERLY_DEAL_DATA, PNL_SEED_DATA } from "@/lib/proforma";
import { HUBSPOT_DEAL_DATA, HUBSPOT_RENEWAL_DATA } from "@/lib/hubspot-live";

type Tab = "deals" | "breakdown" | "churn" | "pnl";

function fmtDollar(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtVar(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtDollar(n)}`;
}

function variancePct(proforma: number, live: number): number {
  if (proforma === 0) return live === 0 ? 0 : 100;
  return ((live - proforma) / Math.abs(proforma)) * 100;
}

function qualityBadge(pct: number): { label: string; color: string; dot: string } {
  const abs = Math.abs(pct);
  if (abs === 0)
    return { label: "Match", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (abs <= 3)
    return { label: "Close", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (abs <= 10)
    return { label: "Gap", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400", dot: "bg-amber-500" };
  return { label: "Diverged", color: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400", dot: "bg-red-500" };
}

const TABS: { key: Tab; label: string }[] = [
  { key: "deals", label: "New Business ARR" },
  { key: "breakdown", label: "Deal Type Breakdown" },
  { key: "churn", label: "Churn" },
  { key: "pnl", label: "P&L" },
];

export default function ReconciliationPage() {
  const [tab, setTab] = useState<Tab>("deals");

  const matchCount = QUARTERLY_DEAL_DATA.reduce((acc, pf) => {
    const hs = HUBSPOT_DEAL_DATA.find((h) => h.quarter === pf.quarter);
    if (!hs) return acc;
    const pct = variancePct(pf.new_business_arr, hs.total_closed_arr);
    return Math.abs(pct) <= 3 ? acc + 1 : acc;
  }, 0);

  const gapCount = QUARTERLY_DEAL_DATA.length - matchCount;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 dark:text-white">
            Proforma Reconciliation
          </h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Seed data (source of truth) vs. HubSpot live pull — 2024‑Q1 to 2026‑Q2
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {matchCount} close
          </span>
          {gapCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {gapCount} with variance
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">
            {QUARTERLY_DEAL_DATA.length} quarters
          </span>
        </div>
      </div>

      {/* Source indicators */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-gray-800 card-elevated">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Proforma</span>
          <span className="text-[10px] text-gray-400">seed data</span>
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-500" />
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">HubSpot</span>
          <span className="text-[10px] text-gray-400">live pull 2026-07-23</span>
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">QBO P&L</span>
          <span className="text-[10px] text-gray-400">needs sync</span>
        </div>
        <div className="flex-1" />
        <span className="text-[10px] font-mono text-gray-400">
          {HUBSPOT_DEAL_DATA.length} quarters synced
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "text-[#EF373E] border-[#EF373E]"
                : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deals" && <DealTab />}
      {tab === "breakdown" && <BreakdownTab />}
      {tab === "churn" && <ChurnTab />}
      {tab === "pnl" && <PnlTab />}
    </div>
  );
}

/* ─── Deal Tab ─── */
function DealTab() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden card-elevated">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#141414] text-white">
              <Th left>Quarter</Th>
              <Th>Proforma <Tag c="amber">SEED</Tag></Th>
              <Th>HubSpot Total <Tag c="sky">LIVE</Tag></Th>
              <Th>$ Variance</Th>
              <Th>% Var</Th>
              <Th>Count (PF / HS)</Th>
              <Th center>Quality</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {QUARTERLY_DEAL_DATA.map((pf, i) => {
              const hs = HUBSPOT_DEAL_DATA.find((h) => h.quarter === pf.quarter);
              const pfVal = pf.new_business_arr;
              const hsTotal = hs?.total_closed_arr ?? 0;
              const variance = hsTotal - pfVal;
              const pct = hs ? variancePct(pfVal, hsTotal) : 0;
              const q = qualityBadge(pct);
              const yearBreak = i > 0 && pf.quarter.slice(0, 4) !== QUARTERLY_DEAL_DATA[i - 1].quarter.slice(0, 4);

              return (
                <tr key={pf.quarter} className={`${stripe(i)} hover:bg-sky-50/50 dark:hover:bg-sky-900/10 ${yearBreak ? "border-t-2 !border-gray-300 dark:!border-gray-600" : ""}`}>
                  <Td left bold>{pf.quarter}</Td>
                  <Td muted>{fmtDollar(pfVal)}</Td>
                  <Td bold>{hs ? fmtDollar(hsTotal) : "—"}</Td>
                  <Td className={varColor(variance)}>{hs ? fmtVar(variance) : "—"}</Td>
                  <Td className={pctColor(pct)}>{hs ? fmtPct(pct) : "—"}</Td>
                  <Td muted>{pf.new_business_count} / {hs?.total_closed_count ?? "—"}</Td>
                  <Td center>
                    {hs && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${q.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${q.dot}`} />
                        {q.label}
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Breakdown Tab ─── */
function BreakdownTab() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden card-elevated">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#141414] text-white">
              <Th left>Quarter</Th>
              <Th>HS New Biz</Th>
              <Th>HS Expansion</Th>
              <Th>HS Cross-sell</Th>
              <Th>HS Unassigned</Th>
              <Th>HS Total</Th>
              <Th>PF New Biz</Th>
              <Th>PF Expansion</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {QUARTERLY_DEAL_DATA.map((pf, i) => {
              const hs = HUBSPOT_DEAL_DATA.find((h) => h.quarter === pf.quarter);
              const yearBreak = i > 0 && pf.quarter.slice(0, 4) !== QUARTERLY_DEAL_DATA[i - 1].quarter.slice(0, 4);
              return (
                <tr key={pf.quarter} className={`${stripe(i)} hover:bg-sky-50/50 dark:hover:bg-sky-900/10 ${yearBreak ? "border-t-2 !border-gray-300 dark:!border-gray-600" : ""}`}>
                  <Td left bold>{pf.quarter}</Td>
                  <Td>{hs ? fmtDollar(hs.new_business_arr) : "—"}</Td>
                  <Td>{hs ? fmtDollar(hs.expansion_arr) : "—"}</Td>
                  <Td>{hs ? fmtDollar(hs.crosssell_arr) : "—"}</Td>
                  <Td>{hs ? fmtDollar(hs.unassigned_arr) : "—"}</Td>
                  <Td bold>{hs ? fmtDollar(hs.total_closed_arr) : "—"}</Td>
                  <Td muted>{fmtDollar(pf.new_business_arr)}</Td>
                  <Td muted>{fmtDollar(pf.expansion_arr)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Churn Tab ─── */
function ChurnTab() {
  return (
    <div className="space-y-5">
      {/* Formula callout */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-gray-800 card-elevated">
        <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
          <span className="text-amber-600 text-[11px] font-bold">!</span>
        </div>
        <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
          <p>
            <strong className="text-gray-800 dark:text-gray-200">Proforma formula:</strong>{" "}
            <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">
              churned_arr = expiring_arr &minus; renewal_arr
            </code>{" "}
            (exact to the dollar for every quarter with waterfall data)
          </p>
          <p>
            Churn is the <strong className="text-gray-700 dark:text-gray-300">total ARR gap</strong> in the retention waterfall — full churns + downsells + any renewal reduction.
            Not a count of &ldquo;Churned&rdquo; stage deals.
          </p>
        </div>
      </div>

      {/* Primary: expiring_arr on churned deals vs PF churn */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden card-elevated">
        <div className="px-4 py-2.5 bg-[#141414] text-white flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider">Churned deals: expiring_arr vs Proforma</span>
          <span className="text-[9px] font-mono text-gray-400">best-match field</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#1e1e1e] text-white">
                <Th left>Quarter</Th>
                <Th>Proforma <Tag c="amber">SEED</Tag></Th>
                <Th>HS expiring_arr <Tag c="sky">LIVE</Tag></Th>
                <Th>$ Variance</Th>
                <Th>% Var</Th>
                <Th>HS hs_arr</Th>
                <Th>Count (PF / HS)</Th>
                <Th center>Quality</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {QUARTERLY_DEAL_DATA.map((pf, i) => {
                const hs = HUBSPOT_RENEWAL_DATA.find((h) => h.quarter === pf.quarter);
                const pfChurn = pf.churned_arr;
                const hsExpiring = hs?.churned_expiring_arr ?? 0;
                const hsArr = hs?.churned_arr ?? 0;
                const variance = hs ? hsExpiring - pfChurn : 0;
                const pct = hs ? variancePct(pfChurn, hsExpiring) : 0;
                const q = qualityBadge(pct);
                const yearBreak = i > 0 && pf.quarter.slice(0, 4) !== QUARTERLY_DEAL_DATA[i - 1].quarter.slice(0, 4);
                const isModeled = pf.expiring_arr > 0;

                return (
                  <tr key={pf.quarter} className={`${stripe(i)} hover:bg-sky-50/50 dark:hover:bg-sky-900/10 ${yearBreak ? "border-t-2 !border-gray-300 dark:!border-gray-600" : ""}`}>
                    <Td left bold>
                      {pf.quarter}
                      {isModeled
                        ? <span className="ml-1.5 text-[8px] font-bold px-1 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">MODEL</span>
                        : <span className="ml-1.5 text-[8px] font-bold px-1 rounded bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">SEEDED</span>
                      }
                    </Td>
                    <Td muted>{fmtDollar(pfChurn)}</Td>
                    <Td bold>{hs ? fmtDollar(hsExpiring) : "—"}</Td>
                    <Td className={varColor(variance)}>{hs ? fmtVar(variance) : "—"}</Td>
                    <Td className={pctColor(pct)}>{hs ? fmtPct(pct) : "—"}</Td>
                    <Td className="text-gray-400">{hs ? fmtDollar(hsArr) : "—"}</Td>
                    <Td muted>{pf.churned_count} / {hs?.churned_count ?? "—"}</Td>
                    <Td center>
                      {hs && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${q.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${q.dot}`} />
                          {q.label}
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 dark:bg-[#1e2130] border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 space-y-1">
          <p>
            <span className="inline-flex items-center gap-1"><span className="text-[8px] font-bold px-1 rounded bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">SEEDED</span> 2024:</span>{" "}
            Proforma churn was seeded from HubSpot <code className="text-[10px] font-mono">expiring_arr</code> on churned deals (0.5&ndash;7% variance).
          </p>
          <p>
            <span className="inline-flex items-center gap-1"><span className="text-[8px] font-bold px-1 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">MODEL</span> 2025+:</span>{" "}
            Proforma projects its own expiring &amp; renewal ARR via the retention waterfall. HubSpot actuals are ~22% lower.
          </p>
        </div>
      </div>

      {/* Waterfall: total expiring → renewed → implied churn */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden card-elevated">
        <div className="px-4 py-2.5 bg-[#141414] text-white">
          <span className="text-[11px] font-bold uppercase tracking-wider">Retention waterfall — full pipeline</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#1e1e1e] text-white">
                <Th left>Quarter</Th>
                <Th>PF Expiring</Th>
                <Th>HS Expiring</Th>
                <Th>PF Renewed</Th>
                <Th>HS Renewed</Th>
                <Th>PF Churn</Th>
                <Th>HS Implied Churn</Th>
                <Th>% Var</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {QUARTERLY_DEAL_DATA.map((pf, i) => {
                const hs = HUBSPOT_RENEWAL_DATA.find((h) => h.quarter === pf.quarter);
                const pfExpiring = pf.expiring_arr;
                const hsExpiring = hs ? hs.renewed_expiring_arr + hs.churned_expiring_arr : 0;
                const pfRenewal = pf.renewal_arr;
                const hsRenewal = hs?.renewed_arr ?? 0;
                const pfChurn = pf.churned_arr;
                const hsImpliedChurn = hs ? hsExpiring - hsRenewal : 0;
                const pct = pfChurn > 0 ? variancePct(pfChurn, hsImpliedChurn) : 0;
                const yearBreak = i > 0 && pf.quarter.slice(0, 4) !== QUARTERLY_DEAL_DATA[i - 1].quarter.slice(0, 4);

                return (
                  <tr key={pf.quarter} className={`${stripe(i)} hover:bg-sky-50/50 dark:hover:bg-sky-900/10 ${yearBreak ? "border-t-2 !border-gray-300 dark:!border-gray-600" : ""}`}>
                    <Td left bold>{pf.quarter}</Td>
                    <Td muted>{pfExpiring > 0 ? fmtDollar(pfExpiring) : "—"}</Td>
                    <Td>{hs ? fmtDollar(hsExpiring) : "—"}</Td>
                    <Td muted>{pfRenewal > 0 ? fmtDollar(pfRenewal) : "—"}</Td>
                    <Td>{hs ? fmtDollar(hsRenewal) : "—"}</Td>
                    <Td bold>{fmtDollar(pfChurn)}</Td>
                    <Td bold>{hs ? fmtDollar(hsImpliedChurn) : "—"}</Td>
                    <Td className={pfExpiring > 0 ? pctColor(pct) : "text-gray-400"}>
                      {hs && pfExpiring > 0 ? fmtPct(pct) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 dark:bg-[#1e2130] border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500">
          <strong className="text-gray-700 dark:text-gray-300">HS Implied Churn</strong>{" "}
          = total expiring ARR (renewed + churned deals&apos; <code className="text-[10px] font-mono">expiring_arr</code>) &minus; renewed <code className="text-[10px] font-mono">hs_arr</code>.
          This captures full churns + downsells, matching the Proforma&apos;s definition.
        </div>
      </div>
    </div>
  );
}

/* ─── P&L Tab ─── */
function PnlTab() {
  const LINE_ITEMS: { label: string; field: keyof (typeof PNL_SEED_DATA)[0]; bold?: boolean; indent?: boolean; expense?: boolean }[] = [
    { label: "Revenue", field: "revenue" },
    { label: "COGS", field: "cogs", expense: true },
    { label: "Gross Profit", field: "gross_profit", bold: true },
    { label: "Operating Expenses", field: "operating_expenses", expense: true },
    { label: "S&M Expenses", field: "sm_expenses", indent: true, expense: true },
    { label: "Net Income", field: "net_income", bold: true },
    { label: "Interest", field: "interest", indent: true },
    { label: "Taxes", field: "taxes", indent: true },
    { label: "D&A", field: "depreciation_amortization", indent: true },
    { label: "EBITDA", field: "ebitda", bold: true },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden card-elevated">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#141414] text-white">
                <Th left className="w-[180px]">Line Item</Th>
                {PNL_SEED_DATA.map((pf) => (
                  <Th key={pf.quarter}>{pf.quarter} <Tag c="amber">SEED</Tag></Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {LINE_ITEMS.map((item, i) => (
                <tr key={item.field} className={`${stripe(i)} hover:bg-sky-50/50 dark:hover:bg-sky-900/10`}>
                  <Td left className={item.indent ? "pl-6" : ""} bold={item.bold}>{item.label}</Td>
                  {PNL_SEED_DATA.map((pf) => {
                    const val = pf[item.field] as number;
                    return (
                      <Td key={pf.quarter} bold={item.bold} className={val < 0 ? "text-red-500" : ""}>
                        {item.expense && val > 0 ? `(${fmtDollar(val)})` : fmtDollar(val)}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 dark:bg-[#1e2130] border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500">
          <strong className="text-gray-700 dark:text-gray-300">QBO comparison:</strong>{" "}
          Connect to QuickBooks on the Trial Balance page, then sync P&L for these quarters to populate QBO actuals.
        </div>
      </div>
    </div>
  );
}

/* ─── Table primitives ─── */
function Th({ children, left, center, className = "" }: { children: React.ReactNode; left?: boolean; center?: boolean; className?: string }) {
  return (
    <th className={`px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap ${left ? "text-left" : center ? "text-center" : "text-right"} ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, left, center, bold, muted, className = "" }: { children: React.ReactNode; left?: boolean; center?: boolean; bold?: boolean; muted?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${left ? "text-left" : center ? "text-center" : "text-right"} ${bold ? "font-bold text-gray-900 dark:text-white" : ""} ${muted ? "text-gray-500" : ""} ${className}`}>
      {children}
    </td>
  );
}

function Tag({ children, c }: { children: React.ReactNode; c: "amber" | "sky" }) {
  const cls = c === "amber"
    ? "text-amber-400 bg-amber-400/10"
    : "text-sky-400 bg-sky-400/10";
  return <span className={`text-[8px] font-bold px-1 rounded ml-1 ${cls}`}>{children}</span>;
}

function stripe(i: number) {
  return i % 2 === 0
    ? "bg-white dark:bg-[#1a1d27]"
    : "bg-gray-50/50 dark:bg-[#1e2130]";
}

function varColor(n: number) {
  if (n === 0) return "text-emerald-600 font-bold";
  return n > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold";
}

function pctColor(pct: number) {
  const abs = Math.abs(pct);
  if (abs <= 1) return "text-emerald-600 font-bold";
  if (abs <= 5) return "text-amber-600 font-bold";
  return "text-red-500 font-bold";
}
