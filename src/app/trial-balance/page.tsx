"use client";

import { useCallback, useEffect, useState } from "react";
import { QboConnect } from "@/components/qbo-connect";
import { TrialBalanceTable } from "@/components/trial-balance-table";
import { RevenueReconciliation } from "@/components/revenue-reconciliation";
import type { TrialBalanceRow, HsRevenueSummary } from "@/lib/types";

type Snapshot = {
  id: string;
  year_month: string;
  entity: string;
  synced_at: string;
};

function getPriorMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function generateMonthOptions(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function TrialBalancePage() {
  const [qboConnected, setQboConnected] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [selectedEntity, setSelectedEntity] = useState("RTS");

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [hsMonths, setHsMonths] = useState<string[]>([]);

  const [currentRows, setCurrentRows] = useState<TrialBalanceRow[]>([]);
  const [priorRows, setPriorRows] = useState<TrialBalanceRow[]>([]);
  const [hsRevenue, setHsRevenue] = useState<HsRevenueSummary | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const loadData = useCallback(async (month: string, entity: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/tb/data?yearMonth=${month}&entity=${entity}`
      );
      const data = await res.json();
      setCurrentRows(data.rows || []);
      setCurrentSnapshot(data.snapshot || null);
      setHsRevenue(data.hsRevenue || null);

      const prior = getPriorMonth(month);
      const priorRes = await fetch(
        `/api/tb/data?yearMonth=${prior}&entity=${entity}`
      );
      const priorData = await priorRes.json();
      setPriorRows(priorData.rows || []);
    } catch {
      setCurrentRows([]);
      setPriorRows([]);
      setHsRevenue(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedMonth, selectedEntity);
  }, [selectedMonth, selectedEntity, loadData]);

  async function fetchSnapshots() {
    try {
      const res = await fetch("/api/tb/snapshots");
      const data = await res.json();
      setSnapshots(data.snapshots || []);
      setHsMonths(data.hsMonths || []);
    } catch {
      /* ignore */
    }
  }

  async function syncTrialBalance() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/qbo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: selectedMonth,
          entity: selectedEntity,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: "error", text: data.error });
      } else {
        setMessage({
          type: "success",
          text: `Synced ${data.rows_count} accounts for ${formatMonth(selectedMonth)}`,
        });
        await fetchSnapshots();
        await loadData(selectedMonth, selectedEntity);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function seedHubspot() {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/hubspot/seed", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: "error", text: data.error });
      } else {
        setMessage({
          type: "success",
          text: `Seeded ${data.seeded} months of HubSpot revenue data`,
        });
        await fetchSnapshots();
        await loadData(selectedMonth, selectedEntity);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Seed failed",
      });
    } finally {
      setSeeding(false);
    }
  }

  const hasSnapshot = snapshots.some(
    (s) => s.year_month === selectedMonth && s.entity === selectedEntity
  );
  const hasHsData = hsMonths.includes(selectedMonth);
  const monthOptions = generateMonthOptions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Trial Balance Analyzer
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sync from QuickBooks, compare month-over-month, reconcile with
            HubSpot
          </p>
        </div>
        <QboConnect onStatusChange={setQboConnected} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
              {snapshots.some((s) => s.year_month === m) ? " (synced)" : ""}
            </option>
          ))}
        </select>

        <select
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        >
          <option value="RTS">RTS</option>
          <option value="PASKR">PASKR</option>
          <option value="RTP">RTP Consolidated</option>
        </select>

        <button
          onClick={syncTrialBalance}
          disabled={!qboConnected || syncing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {syncing ? "Syncing..." : "Sync from QBO"}
        </button>

        {!hasHsData && (
          <button
            onClick={seedHubspot}
            disabled={seeding}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {seeding ? "Seeding..." : "Seed HubSpot Data"}
          </button>
        )}

        {currentSnapshot && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            Last synced:{" "}
            {new Date(currentSnapshot.synced_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Loading state */}
      {loadingData && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading trial balance data...
        </div>
      )}

      {/* Empty state */}
      {!loadingData && currentRows.length === 0 && (
        <div className="text-center py-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No trial balance data for {formatMonth(selectedMonth)}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {qboConnected
              ? `Click "Sync from QBO" to pull the trial balance for ${selectedEntity}.`
              : "Connect to QuickBooks to sync your trial balance data."}
          </p>
        </div>
      )}

      {/* Trial Balance Table */}
      {!loadingData && currentRows.length > 0 && (
        <TrialBalanceTable
          currentRows={currentRows}
          priorRows={priorRows}
          currentMonth={formatMonth(selectedMonth)}
          priorMonth={
            priorRows.length > 0 ? formatMonth(getPriorMonth(selectedMonth)) : null
          }
        />
      )}

      {/* Revenue Reconciliation */}
      {!loadingData && currentRows.length > 0 && (
        <RevenueReconciliation
          tbRows={currentRows}
          hsRevenue={hsRevenue}
          yearMonth={selectedMonth}
        />
      )}

      {/* HubSpot Revenue Summary (always show if data exists) */}
      {!loadingData && hasHsData && currentRows.length === 0 && hsRevenue && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            HubSpot Revenue — {formatMonth(selectedMonth)}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {hsRevenue.deals_won}
              </div>
              <div className="text-xs text-gray-500">Deals Won</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                ${hsRevenue.total_revenue.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                ${hsRevenue.total_arr.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total ARR</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
