"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// Only allow same-origin relative paths as the post-login destination.
function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginCard() {
  const params = useSearchParams();
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));
  const errorParam = params.get("error");
  const [busy, setBusy] = useState(false);

  async function onSignIn() {
    if (busy) return;
    setBusy(true);
    try {
      await signIn("google", { redirectTo: callbackUrl });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#141414]">
      <div className="w-full max-w-[400px] bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/[0.06] rounded-xl px-8 pt-9 pb-7 shadow-2xl">
        <div className="mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://redteam.com/wp-content/uploads/2022/09/logo-1.svg"
            alt="RedTeam"
            className="h-5 dark:invert dark:brightness-0"
          />
          <div className="mt-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">
            Finance Suite
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          This dashboard is restricted to RedTeam employees. Use your{" "}
          <span className="font-semibold text-gray-900 dark:text-gray-200 whitespace-nowrap">
            @redteam.com
          </span>{" "}
          Google account.
        </p>

        {errorParam && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-[#EF373E]/35 bg-[#EF373E]/10 px-3 py-2.5 text-[13px] text-[#B91C1C] dark:text-[#FCA5A5]"
          >
            {errorParam === "AccessDenied"
              ? "Only @redteam.com accounts are allowed to sign in."
              : "Sign in failed. Please try again."}
          </div>
        )}

        <button
          type="button"
          onClick={onSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[#dadce0] bg-white text-[#1f1f1f] text-[15px] font-medium transition hover:bg-[#f8f9fa] hover:shadow-sm disabled:opacity-70 disabled:cursor-default cursor-pointer"
        >
          <GoogleGlyph />
          <span>{busy ? "Signing in..." : "Sign in with Google"}</span>
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
