"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = {
  connected: boolean;
  realm_id?: string;
  connected_at?: string;
};

export function QboConnect({ onStatusChange }: { onStatusChange?: (connected: boolean) => void }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/qbo/status");
      const data = await res.json();
      setStatus(data);
      onStatusChange?.(data.connected);
    } catch {
      setStatus({ connected: false });
      onStatusChange?.(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    await fetch("/api/qbo/disconnect", { method: "POST" });
    await checkStatus();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        Checking QuickBooks connection...
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-700 dark:text-green-400 font-medium">
            Connected
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            Realm {status.realm_id}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/qbo/connect"
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      Connect to QuickBooks
    </a>
  );
}
