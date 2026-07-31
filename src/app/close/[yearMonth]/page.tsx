"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ClosePeriod } from "@/lib/types";
import { CloseChecklist } from "@/components/close-checklist";
import Link from "next/link";

export default function ClosePeriodPage({
  params,
}: {
  params: Promise<{ yearMonth: string }>;
}) {
  const { yearMonth } = use(params);
  const router = useRouter();
  const [period, setPeriod] = useState<ClosePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchPeriod = useCallback(async () => {
    const { data } = await supabase
      .from("close_periods")
      .select("*")
      .eq("year_month", yearMonth)
      .single();

    if (!data) {
      setNotFound(true);
    } else {
      setPeriod(data);
    }
    setLoading(false);
  }, [yearMonth]);

  useEffect(() => {
    fetchPeriod();
  }, [fetchPeriod]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading...</div>
    );
  }

  if (notFound || !period) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
          Close period not found for {yearMonth}
        </p>
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          &larr; Back to dashboard
        </Link>

        {period.status === "closed" && (
          <div className="mt-3 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              This period is closed
              {period.closed_at &&
                ` — ${new Date(period.closed_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`}
            </span>
          </div>
        )}
      </div>

      <CloseChecklist
        periodId={period.id}
        yearMonth={yearMonth}
        onStatusChange={fetchPeriod}
      />
    </div>
  );
}
