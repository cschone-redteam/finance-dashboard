"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";

type Props = {
  userEmail: string | null;
  children: React.ReactNode;
};

// The login page renders full-screen without the sidebar chrome.
export function AppShell({ userEmail, children }: Props) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="flex-1 min-w-0">{children}</main>;
  }

  return (
    <>
      <SidebarNav userEmail={userEmail} />
      <main className="flex-1 min-w-0 ml-[220px] print:ml-0 min-h-screen">
        <div className="px-6 py-6">{children}</div>
      </main>
    </>
  );
}
