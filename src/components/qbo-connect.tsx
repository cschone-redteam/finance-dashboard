"use client";

import { useEffect, useState } from "react";

type ConnectedRealm = { realm_id: string; connected_at: string };

type ConnectionStatus = {
  connected: boolean;
  realm_id?: string;
  connected_at?: string;
  realms?: ConnectedRealm[];
};

const REALM_LABELS: Record<string, string> = {
  "9130354139516116": "RTP Consolidated",
  "1223699155": "RedTeam",
  "791016560": "PASKR",
};

function realmLabel(realmId: string): string {
  return REALM_LABELS[realmId] || `Company ${realmId.slice(-6)}`;
}

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

  async function disconnectRealm(realmId: string) {
    await fetch("/api/qbo/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realmId }),
    });
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

  if (status?.connected && status.realms) {
    return (
      <div className="flex flex-col gap-2 items-end">
        {status.realms.map((r) => (
          <div key={r.realm_id} className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-700 dark:text-green-400 font-medium">
                {realmLabel(r.realm_id)}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">
                {r.realm_id}
              </span>
            </div>
            <button
              onClick={() => disconnectRealm(r.realm_id)}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline"
            >
              Disconnect
            </button>
          </div>
        ))}
        <a
          href="/api/qbo/connect"
          className="inline-flex items-center gap-1.5 text-xs text-[#40A4EB] hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Connect another company
        </a>
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
