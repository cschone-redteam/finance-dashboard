"use client";

import { useEffect, useState, useCallback } from "react";
import { getStepsByDay, TOTAL_STEPS } from "@/lib/close-steps";
import type { CloseTaskCompletion } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { CloseStep } from "./close-step";
import { ProgressBar } from "./progress-bar";

const DAY_GROUPS = getStepsByDay();

export function CloseChecklist({
  periodId,
  yearMonth,
  onStatusChange,
}: {
  periodId: string;
  yearMonth: string;
  onStatusChange?: () => void;
}) {
  const [completions, setCompletions] = useState<CloseTaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompletions = useCallback(async () => {
    const { data } = await supabase
      .from("close_task_completions")
      .select("*")
      .eq("period_id", periodId);
    setCompletions(data ?? []);
    setLoading(false);
  }, [periodId]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  function handleUpdate() {
    fetchCompletions();
    onStatusChange?.();
  }

  const completedCount = completions.filter((c) => c.completed).length;

  async function markClosed() {
    await supabase
      .from("close_periods")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", periodId);
    onStatusChange?.();
  }

  async function reopenPeriod() {
    await supabase
      .from("close_periods")
      .update({ status: "in_progress", closed_at: null })
      .eq("id", periodId);
    onStatusChange?.();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        Loading checklist...
      </div>
    );
  }

  const monthLabel = formatYearMonth(yearMonth);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {monthLabel} Close
        </h2>
        <ProgressBar
          completed={completedCount}
          total={TOTAL_STEPS}
          label="Overall progress"
        />
      </div>

      <div className="space-y-4">
        {DAY_GROUPS.map((group) => {
          const dayCompleted = group.steps.filter((s) =>
            completions.find((c) => c.step_index === s.index && c.completed)
          ).length;

          return (
            <div
              key={group.day}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {group.label}
                </h3>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {dayCompleted}/{group.steps.length}
                </span>
              </div>

              <div className="px-0">
                <ProgressBar completed={dayCompleted} total={group.steps.length} />
              </div>

              {group.steps.map((step) => (
                <CloseStep
                  key={step.index}
                  step={step}
                  periodId={periodId}
                  completion={completions.find(
                    (c) => c.step_index === step.index
                  )}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        {completedCount === TOTAL_STEPS && (
          <button
            onClick={markClosed}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Mark Close Complete
          </button>
        )}
        <button
          onClick={reopenPeriod}
          className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Reopen Period
        </button>
      </div>
    </div>
  );
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}
