"use client";

import { Fragment, useEffect, useState } from "react";

const MONTHS = [
  "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26",
  "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26",
];

const ACTUAL_THROUGH = 7;

const PRODUCTS = ["Flex", "Go", "FieldLens", "TeamPlayer"] as const;
type Product = (typeof PRODUCTS)[number];

type RowKey = "beginning" | "new" | "upsell" | "expansion" | "price_increase" | "downsell" | "churn" | "ending";

type RowDef = {
  key: RowKey;
  label: string;
  bold?: boolean;
  border?: "top";
  expandable?: boolean;
};

const ROW_DEFS: RowDef[] = [
  { key: "beginning", label: "Beginning ARR", bold: true },
  { key: "new", label: "(+) New", expandable: true },
  { key: "upsell", label: "(+) Upsell" },
  { key: "expansion", label: "(+) Expansion", expandable: true },
  { key: "price_increase", label: "(+) Price Increase" },
  { key: "downsell", label: "(-) Downsell", expandable: true },
  { key: "churn", label: "(-) Churn", expandable: true },
  { key: "ending", label: "Ending ARR", bold: true, border: "top" },
];

const INPUT_ROWS: RowKey[] = ["beginning", "new", "upsell", "expansion", "price_increase", "downsell", "churn"];

type ProductData = Record<Product, number[]>;

function emptyProductData(): ProductData {
  return {
    Flex: new Array(12).fill(0),
    Go: new Array(12).fill(0),
    FieldLens: new Array(12).fill(0),
    TeamPlayer: new Array(12).fill(0),
  };
}

function initData(): Record<RowKey, number[]> {
  const empty = () => new Array(12).fill(0);
  return {
    beginning: empty(),
    new: empty(),
    upsell: empty(),
    expansion: empty(),
    price_increase: empty(),
    downsell: empty(),
    churn: empty(),
    ending: empty(),
  };
}

function computeEnding(data: Record<RowKey, number[]>): Record<RowKey, number[]> {
  const result: Record<RowKey, number[]> = {
    beginning: [...data.beginning],
    new: [...data.new],
    upsell: [...data.upsell],
    expansion: [...data.expansion],
    price_increase: [...data.price_increase],
    downsell: [...data.downsell],
    churn: [...data.churn],
    ending: new Array(12).fill(0),
  };

  for (let i = 0; i < 12; i++) {
    result.ending[i] =
      result.beginning[i] +
      result.new[i] +
      result.upsell[i] +
      result.expansion[i] +
      result.price_increase[i] -
      Math.abs(result.downsell[i]) -
      Math.abs(result.churn[i]);

    if (i < 11) {
      result.beginning[i + 1] = result.ending[i];
    }
  }
  return result;
}

function fmt(n: number, negative?: boolean): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const str = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(abs);
  return negative ? `(${str})` : str;
}

const PRODUCT_COLORS: Record<Product, string> = {
  Flex: "text-blue-600 dark:text-blue-400",
  Go: "text-purple-600 dark:text-purple-400",
  FieldLens: "text-emerald-600 dark:text-emerald-400",
  TeamPlayer: "text-amber-600 dark:text-amber-400",
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

export default function ArrRollforwardPage() {
  const [rawData, setRawData] = useState<Record<RowKey, number[]>>(initData);
  const [productBreakdowns, setProductBreakdowns] = useState<Record<string, ProductData>>({});
  const [expanded, setExpanded] = useState<Set<RowKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/arr-rollforward");
        if (!res.ok) throw new Error("Failed to load rollforward data");
        const api = await res.json();

        const breakdowns: Record<string, ProductData> = {};

        setRawData((prev) => {
          const next = { ...prev };
          next.beginning = [...prev.beginning];
          next.beginning[0] = 7540694;

          for (const key of ["new", "churn", "expansion", "downsell"] as const) {
            const cat = api[key];
            if (cat && cat.total) {
              next[key] = cat.total;
              breakdowns[key] = cat.byProduct;
            } else if (cat && Array.isArray(cat)) {
              next[key] = cat;
            }
          }

          return next;
        });

        setProductBreakdowns(breakdowns);
        setInputKey((k) => k + 1);
      } catch (err) {
        console.error("Rollforward load error:", err);
        setRawData((prev) => {
          const next = { ...prev };
          next.beginning = [...prev.beginning];
          next.beginning[0] = 7540694;
          return next;
        });
        setInputKey((k) => k + 1);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const data = computeEnding(rawData);

  const toggleExpand = (key: RowKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleChange = (row: RowKey, monthIdx: number, value: string) => {
    const num = parseFloat(value.replace(/[,$()]/g, "")) || 0;
    setRawData((prev) => {
      const next = { ...prev, [row]: [...prev[row]] };
      next[row][monthIdx] = num;
      return next;
    });
    setInputKey((k) => k + 1);
  };

  const renderProductRow = (parentKey: RowKey, product: Product) => {
    const breakdown = productBreakdowns[parentKey];
    if (!breakdown) return null;
    const values = breakdown[product];
    if (!values || values.every((v) => v === 0)) return null;
    const isNegativeRow = parentKey === "downsell" || parentKey === "churn";

    return (
      <tr key={`${parentKey}-${product}`} className="bg-gray-50/30 dark:bg-white/[0.008]">
        <td className="sticky left-0 z-10 pl-9 pr-4 py-1.5 border-r border-gray-200 dark:border-white/[0.06] whitespace-nowrap bg-gray-50/30 dark:bg-[#0d0d0d]">
          <span className={`text-xs font-medium ${PRODUCT_COLORS[product]}`}>
            {product}
          </span>
        </td>
        {MONTHS.map((_, i) => {
          const val = values[i];
          return (
            <td
              key={i}
              className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap text-xs border-b border-gray-100/50 dark:border-white/[0.02] ${
                isNegativeRow
                  ? "text-red-500/80 dark:text-red-400/70"
                  : "text-gray-500 dark:text-gray-400"
              } ${i > ACTUAL_THROUGH ? "bg-amber-50/20 dark:bg-amber-950/5" : ""}`}
            >
              {fmt(val, isNegativeRow)}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              ARR Rollforward
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Monthly ARR bridge — Jan 2026 through Dec 2026
            </p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading HubSpot data…
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/[0.02]">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-[#141414] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 dark:border-white/[0.06] min-w-[180px]">
                  Category
                </th>
                {MONTHS.map((m, i) => (
                  <th
                    key={m}
                    className={`px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-white/[0.06] min-w-[110px] ${
                      i <= ACTUAL_THROUGH
                        ? "text-gray-600 dark:text-gray-300"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    <div>{m}</div>
                    <div className={`text-[9px] font-medium mt-0.5 ${
                      i <= ACTUAL_THROUGH
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-500 dark:text-amber-500"
                    }`}>
                      {i <= ACTUAL_THROUGH ? "Actual" : "8+4 Fcst"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_DEFS.map((row) => {
                const isInput = INPUT_ROWS.includes(row.key);
                const isEnding = row.key === "ending";
                const isBeginning = row.key === "beginning";
                const isNegativeRow = row.key === "downsell" || row.key === "churn";
                const isExpanded = expanded.has(row.key);
                const hasBreakdown = row.expandable && !!productBreakdowns[row.key];

                return (
                  <Fragment key={row.key}>
                    <tr
                      className={`${row.bold ? "bg-gray-50/50 dark:bg-white/[0.015]" : ""} ${
                        row.border === "top" ? "border-t-2 border-gray-300 dark:border-white/[0.12]" : ""
                      }`}
                    >
                      <td className={`sticky left-0 z-10 px-4 py-2 border-r border-gray-200 dark:border-white/[0.06] whitespace-nowrap ${
                        row.bold
                          ? "font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-[#141414]"
                          : "text-gray-700 dark:text-gray-300 bg-white dark:bg-[#0a0a0a]"
                      }`}>
                        {hasBreakdown ? (
                          <button
                            onClick={() => toggleExpand(row.key)}
                            className="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white transition-colors"
                          >
                            <ChevronIcon expanded={isExpanded} />
                            {row.label}
                          </button>
                        ) : (
                          row.label
                        )}
                      </td>
                      {MONTHS.map((_, i) => {
                        const val = data[row.key][i];
                        const isComputed = isEnding || (isBeginning && i > 0);

                        if (isComputed) {
                          return (
                            <td
                              key={i}
                              className={`px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap border-b border-gray-100 dark:border-white/[0.03] ${
                                row.bold
                                  ? "font-bold text-gray-900 dark:text-white"
                                  : isNegativeRow
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-gray-700 dark:text-gray-300"
                              } ${i > ACTUAL_THROUGH ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                            >
                              {fmt(val, isNegativeRow)}
                            </td>
                          );
                        }

                        if (isInput) {
                          return (
                            <td
                              key={`${i}-${inputKey}`}
                              className={`px-1 py-1 border-b border-gray-100 dark:border-white/[0.03] ${
                                i > ACTUAL_THROUGH ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                              }`}
                            >
                              <input
                                type="text"
                                defaultValue={val !== 0 ? fmt(val, isNegativeRow) : ""}
                                onBlur={(e) => handleChange(row.key, i, e.target.value)}
                                placeholder="—"
                                className={`w-full px-2 py-1.5 text-right text-sm font-mono tabular-nums bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-white/[0.08] focus:border-[#EF373E]/50 focus:ring-1 focus:ring-[#EF373E]/20 rounded outline-none transition-colors ${
                                  row.bold
                                    ? "font-bold text-gray-900 dark:text-white"
                                    : isNegativeRow
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-gray-700 dark:text-gray-300"
                                } placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                              />
                            </td>
                          );
                        }

                        return (
                          <td
                            key={i}
                            className={`px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap border-b border-gray-100 dark:border-white/[0.03] text-gray-700 dark:text-gray-300 ${
                              i > ACTUAL_THROUGH ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                            }`}
                          >
                            {fmt(val)}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && hasBreakdown && PRODUCTS.map((product) =>
                      renderProductRow(row.key, product),
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
