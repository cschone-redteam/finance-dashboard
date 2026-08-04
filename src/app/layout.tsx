import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "./sidebar-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RedTeam Finance Dashboard",
  description: "Finance analytics and reporting for RedTeam",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex bg-[#f5f6f8] dark:bg-[#0f1117]">
        <SidebarNav />
        <main className="flex-1 ml-[220px] print:ml-0 min-h-screen">
          <div className="px-6 py-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
