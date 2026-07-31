"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function NewPeriodModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearMonth, setYearMonth] = useState(defaultYM);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setError("");
    setCreating(true);

    const { data, error: dbError } = await supabase
      .from("close_periods")
      .insert({
        year_month: yearMonth,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      setError(
        dbError.code === "23505"
          ? "A close period for this month already exists."
          : dbError.message
      );
      setCreating(false);
      return;
    }

    router.push(`/close/${data.year_month}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Start New Close Period
        </h2>

        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
          Month
        </label>
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />

        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Start Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
