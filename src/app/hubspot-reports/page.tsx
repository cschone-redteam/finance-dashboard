"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import * as XLSX from "xlsx";

const REPORTS = [
  { key: "churn" as const, label: "Churn" },
  { key: "renewals" as const, label: "Renewals" },
  { key: "bookings" as const, label: "Bookings" },
  { key: "arr-stack" as const, label: "ARR Stack" },
];

type ReportKey = (typeof REPORTS)[number]["key"];

type ColumnDef = {
  key: string;
  label: string;
  format?: "currency" | "date" | "number";
};

type SortConfig = { key: string; dir: "asc" | "desc" } | null;

type ReportRow = Record<string, unknown>;

const REPORT_COLUMNS: Record<ReportKey, ColumnDef[]> = {
  churn: [
    { key: "dealname", label: "Deal Name" },
    { key: "company", label: "Company" },
    { key: "product_owned", label: "Product" },
    { key: "closedate", label: "Close Date", format: "date" },
    { key: "expiring_arr", label: "Renewable ARR", format: "currency" },
    { key: "churn_reason", label: "Churn Reason" },
    { key: "secondary_churn_reason", label: "Secondary Reason" },
    { key: "market_segment", label: "Market Segment" },
  ],
  renewals: [
    { key: "dealname", label: "Deal Name" },
    { key: "company", label: "Company" },
    { key: "owner", label: "Owner" },
    { key: "product_owned", label: "Product" },
    { key: "closedate", label: "Close Date", format: "date" },
    { key: "renewal_date", label: "Renewal Date", format: "date" },
    { key: "expiring_arr", label: "Expiring ARR", format: "currency" },
    { key: "arr", label: "New ARR", format: "currency" },
    { key: "forecast_category", label: "Forecast" },
    { key: "billing_frequency", label: "Billing Freq" },
  ],
  bookings: [
    { key: "dealname", label: "Deal Name" },
    { key: "company", label: "Company" },
    { key: "closedate", label: "Close Date", format: "date" },
    { key: "amount", label: "Amount", format: "currency" },
    { key: "arr", label: "ARR", format: "currency" },
    { key: "tcv", label: "TCV", format: "currency" },
    { key: "deal_type", label: "Type" },
    { key: "product_owned", label: "Product" },
    { key: "billing_frequency", label: "Billing Freq" },
    { key: "owner", label: "Owner" },
  ],
  "arr-stack": [
    { key: "name", label: "Company" },
    { key: "subscription_arr", label: "Sub ARR", format: "currency" },
    { key: "pricing_plan", label: "Pricing Plan" },
    { key: "payment_frequency", label: "Pay Freq" },
    { key: "arr_segment", label: "ARR Segment" },
    { key: "client_segment", label: "Client Segment" },
    { key: "health_status", label: "Health" },
    { key: "csm_owner", label: "CSM Owner" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
  ],
};

function formatCellValue(value: unknown, format?: string): string {
  if (value === null || value === undefined || value === "") return "—";

  if (format === "currency") {
    const num = typeof value === "string" ? parseFloat(value) : Number(value);
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  }

  if (format === "date") {
    const str = String(value);
    const d = new Date(str.includes(" ") && !str.includes("T") ? str.replace(" ", "T") : str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return String(value);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function renderCell(value: unknown, col: ColumnDef): ReactNode {
  if (col.key === "health_status") {
    const str = stripHtml(String(value || ""));
    if (str.includes("Healthy"))
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
          Healthy
        </span>
      );
    if (str.includes("At Risk"))
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
          At Risk
        </span>
      );
    if (str.includes("Onboarding"))
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
          Onboarding
        </span>
      );
    if (!str || str === "—") return <span className="text-gray-400">{"—"}</span>;
    return str;
  }

  if (col.key === "forecast_category") {
    const str = String(value || "");
    if (str === "Closed won")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
          Closed Won
        </span>
      );
    if (str === "Not forecasted" || str === "OMIT")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400">
          {str}
        </span>
      );
    if (str === "Pipeline" || str === "Best case" || str === "Commit")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
          {str}
        </span>
      );
  }

  return formatCellValue(value, col.format);
}

function ReportSummary({ reportKey, rows }: { reportKey: ReportKey; rows: ReportRow[] }) {
  const stats = useMemo(() => {
    const sumField = (field: string) =>
      rows.reduce((sum, r) => {
        const v = parseFloat(String(r[field] || "0"));
        return sum + (isNaN(v) ? 0 : v);
      }, 0);

    switch (reportKey) {
      case "churn":
        return [
          { label: "Churned Deals", value: rows.length.toString() },
          { label: "Total Churned ARR", value: formatCellValue(sumField("expiring_arr"), "currency") },
        ];
      case "bookings":
        return [
          { label: "Deals Closed", value: rows.length.toString() },
          { label: "Total Amount", value: formatCellValue(sumField("amount"), "currency") },
          { label: "Total ARR", value: formatCellValue(sumField("arr"), "currency") },
        ];
      case "renewals":
        return [
          { label: "Renewed Deals", value: rows.length.toString() },
          { label: "Expiring ARR", value: formatCellValue(sumField("expiring_arr"), "currency") },
          { label: "Renewed ARR", value: formatCellValue(sumField("arr"), "currency") },
        ];
      case "arr-stack":
        return [
          { label: "Paying Clients", value: rows.length.toString() },
          { label: "Total Sub ARR", value: formatCellValue(sumField("subscription_arr"), "currency") },
        ];
    }
  }, [reportKey, rows]);

  return (
    <div className="flex gap-4 mb-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg px-4 py-3"
        >
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.label}</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function HubSpotReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportKey>("churn");
  const [reportData, setReportData] = useState<
    Record<ReportKey, { rows: ReportRow[]; synced_at: string | null; loading: boolean }>
  >({
    churn: { rows: [], synced_at: null, loading: false },
    renewals: { rows: [], synced_at: null, loading: false },
    bookings: { rows: [], synced_at: null, loading: false },
    "arr-stack": { rows: [], synced_at: null, loading: false },
  });
  const [sort, setSort] = useState<SortConfig>(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchReport = useCallback(async (type: ReportKey) => {
    setReportData((prev) => ({ ...prev, [type]: { ...prev[type], loading: true } }));
    try {
      const res = await fetch(`/api/hubspot-reports?type=${type}`);
      const data = await res.json();
      setReportData((prev) => ({
        ...prev,
        [type]: {
          rows: data.rows || [],
          synced_at: data.synced_at || null,
          loading: false,
        },
      }));
    } catch {
      setReportData((prev) => ({ ...prev, [type]: { ...prev[type], loading: false } }));
    }
  }, []);

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport, fetchReport]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/hubspot-reports/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok && data.error) {
        setSyncError(data.error);
        return;
      }
      const errors = Object.entries(data.results || {})
        .filter(([, v]) => v && typeof v === "object" && "error" in v)
        .map(([k, v]) => `${k}: ${(v as { error: string }).error}`);
      if (errors.length > 0) {
        setSyncError(errors.join("; "));
      }
      for (const key of REPORTS.map((r) => r.key)) {
        fetchReport(key);
      }
    } catch {
      setSyncError("Failed to connect to sync endpoint");
    } finally {
      setSyncing(false);
    }
  }, [fetchReport]);

  const columns = REPORT_COLUMNS[activeReport];
  const currentData = reportData[activeReport];

  const filteredAndSorted = useMemo(() => {
    let rows = currentData.rows;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        columns.some((c) => String(r[c.key] || "").toLowerCase().includes(q))
      );
    }

    if (sort) {
      rows = [...rows].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        const col = columns.find((c) => c.key === sort.key);

        if (col?.format === "currency" || col?.format === "number") {
          const an = parseFloat(String(av || "0"));
          const bn = parseFloat(String(bv || "0"));
          return sort.dir === "asc" ? an - bn : bn - an;
        }

        const as = String(av || "");
        const bs = String(bv || "");
        return sort.dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
      });
    }

    return rows;
  }, [currentData.rows, search, sort, columns]);

  const handleSort = (key: string) => {
    setSort((prev) =>
      prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }
    );
  };

  const handleExportXlsx = useCallback(() => {
    const wb = XLSX.utils.book_new();
    for (const report of REPORTS) {
      const cols = REPORT_COLUMNS[report.key];
      const rows = reportData[report.key].rows;
      const sheetData = rows.map((row) => {
        const obj: Record<string, string | number> = {};
        for (const c of cols) {
          let val = row[c.key] ?? "";
          if (c.key === "health_status") val = String(val).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
          if (c.format === "currency" || c.format === "number") {
            const num = parseFloat(String(val));
            obj[c.label] = isNaN(num) ? "" : num;
          } else {
            obj[c.label] = String(val);
          }
        }
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, report.label);
    }
    XLSX.writeFile(wb, `hubspot-reports-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [reportData]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            HubSpot Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Revenue and pipeline analytics from HubSpot CRM
          </p>
        </div>

        {syncError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
            {syncError}
          </div>
        )}

        <div className="flex items-center gap-2 mb-6">
          {REPORTS.map((report) => (
            <button
              key={report.key}
              onClick={() => {
                setActiveReport(report.key);
                setSort(null);
                setSearch("");
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeReport === report.key
                  ? "bg-gray-900 dark:bg-white/[0.1] text-white shadow-sm"
                  : "bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06]"
              }`}
            >
              {report.label}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-200 dark:bg-white/[0.08] mx-1" />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {syncing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            )}
            {syncing ? "Syncing..." : "Sync All"}
          </button>
          <button
            onClick={handleExportXlsx}
            disabled={Object.values(reportData).every((d) => d.rows.length === 0)}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export XLSX
          </button>
        </div>

        {currentData.loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : currentData.rows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <svg
              className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-1.5M12 12.75l3 1.5M12 12.75V17.25m-3-4.5l3 1.5"
              />
            </svg>
            <p className="text-gray-400 text-sm font-medium">No data synced yet</p>
            <p className="text-xs text-gray-400 mt-1">Run the seed script to populate report data</p>
          </div>
        ) : (
          <>
            <ReportSummary reportKey={activeReport} rows={currentData.rows} />

            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 w-64 outline-none focus:ring-1 focus:ring-[#EF373E]/50"
              />
              {currentData.synced_at && (
                <span className="text-xs text-gray-400">
                  Synced{" "}
                  {new Date(currentData.synced_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {filteredAndSorted.length}
                {search ? ` of ${currentData.rows.length}` : ""} rows
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap select-none ${
                          col.format === "currency" || col.format === "number"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sort?.key === col.key && (
                            <span className="text-[#EF373E]">
                              {sort.dir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {filteredAndSorted.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 whitespace-nowrap ${
                            col.format === "currency" || col.format === "number"
                              ? "text-right font-mono text-gray-700 dark:text-gray-300"
                              : "text-gray-700 dark:text-gray-300"
                          } ${
                            col.key === "dealname" || col.key === "name"
                              ? "font-medium text-gray-900 dark:text-white max-w-[300px] truncate"
                              : ""
                          } ${
                            col.key === "churn_reason" ||
                            col.key === "secondary_churn_reason" ||
                            col.key === "churn_detail"
                              ? "max-w-[200px] truncate"
                              : ""
                          }`}
                          title={
                            col.key === "dealname" ||
                            col.key === "name" ||
                            col.key === "churn_reason" ||
                            col.key === "churn_detail"
                              ? String(row[col.key] || "")
                              : undefined
                          }
                        >
                          {renderCell(row[col.key], col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
