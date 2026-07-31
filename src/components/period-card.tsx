"use client";

import Link from "next/link";
import type { ClosePeriod } from "@/lib/types";
import { TOTAL_STEPS } from "@/lib/close-steps";

const STATUS_STYLES = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  closed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

export function PeriodCard({
  period,
  completedCount,
}: {
  period: ClosePeriod;
  completedCount: number;
}) {
  const pct = Math.round((completedCount / TOTAL_STEPS) * 100);
  const [year, month] = period.year_month.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const label = `${months[parseInt(month, 10) - 1]} ${year}`;

  return (
    <Link
      href={`/close/${period.year_month}`}
      className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {label}
        </h3>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[period.status]}`}
        >
          {STATUS_LABELS[period.status]}
        </span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>
            {completedCount}/{TOTAL_STEPS} ({pct}%)
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct === 100
                ? "bg-green-500"
                : pct > 50
                  ? "bg-blue-500"
                  : "bg-blue-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {period.closed_at && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Closed{" "}
          {new Date(period.closed_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
    </Link>
  );
}
