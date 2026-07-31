"use client";

import { CadencePanel } from "@/components/cadence-panel";

export default function CadencePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Activity Cadence
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Daily, weekly, and monthly accounting activities with procedural notes
        </p>
      </div>

      <CadencePanel />
    </div>
  );
}
