"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut({ redirectTo: "/login" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-[11px] font-medium text-gray-500 hover:text-gray-300 underline underline-offset-2 cursor-pointer disabled:cursor-default"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
