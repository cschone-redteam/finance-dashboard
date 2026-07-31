"use client";

type FlagLevel = "normal" | "warning" | "alert" | "zero_expected";

const FLAG_STYLES: Record<FlagLevel, { bg: string; text: string; label: string }> = {
  normal: { bg: "", text: "", label: "" },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "Variance",
  },
  alert: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    label: "Alert",
  },
  zero_expected: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    label: "Should be $0",
  },
};

export function VarianceFlag({ flag }: { flag: FlagLevel }) {
  if (flag === "normal") return null;
  const style = FLAG_STYLES[flag];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function classifyVariance(
  accountName: string,
  variancePct: number | null
): FlagLevel {
  const zeroAccounts = [
    "Opening Balance Equity",
    "Uncategorized Income",
    "Uncategorized Expense",
    "Uncategorized Asset",
    "Undeposited Funds",
  ];

  if (zeroAccounts.some((z) => accountName.toLowerCase().includes(z.toLowerCase()))) {
    return "zero_expected";
  }

  if (variancePct === null) return "normal";
  const abs = Math.abs(variancePct);
  if (abs >= 50) return "alert";
  if (abs >= 20) return "warning";
  return "normal";
}
