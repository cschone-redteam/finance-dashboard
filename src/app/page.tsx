"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ClosePeriod } from "@/lib/types";
import { PeriodCard } from "@/components/period-card";
import { NewPeriodModal } from "@/components/new-period-modal";

type PeriodWithCount = {
  period: ClosePeriod;
  completedCount: number;
};

export default function Dashboard() {
  const [periods, setPeriods] = useState<PeriodWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchPeriods = useCallback(async () => {
    const { data: periodRows } = await supabase
      .from("close_periods")
      .select("*")
      .order("year_month", { ascending: false });

    if (!periodRows) {
      setLoading(false);
      return;
    }

    const withCounts: PeriodWithCount[] = await Promise.all(
      periodRows.map(async (period: ClosePeriod) => {
        const { count } = await supabase
          .from("close_task_completions")
          .select("*", { count: "exact", head: true })
          .eq("period_id", period.id)
          .eq("completed", true);
        return { period, completedCount: count ?? 0 };
      })
    );

    setPeriods(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Close Tracker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track close progress for RTS, PASKR, and RTP Consolidated
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          New Close Period
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="text-lg font-medium">No close periods yet</p>
            <p className="text-sm mt-1">
              Start your first month-end close to begin tracking.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start First Close
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map(({ period, completedCount }) => (
            <PeriodCard
              key={period.id}
              period={period}
              completedCount={completedCount}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewPeriodModal
          onClose={() => {
            setShowModal(false);
            fetchPeriods();
          }}
        />
      )}
    </div>
  );
}
