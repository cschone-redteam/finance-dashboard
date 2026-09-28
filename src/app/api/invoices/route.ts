import { NextRequest, NextResponse } from "next/server";
import { fetchOutstandingInvoices, type OutstandingInvoice } from "@/lib/qbo";
import { getCompanyOwners } from "@/lib/hubspot";
import { fetchChargebeeOutstandingInvoices } from "@/lib/chargebee";
import { supabaseAdmin } from "@/lib/supabase-server";

const REALMS: Record<string, string> = {
  flex: "1223699155",
  go: "791016560",
};

const INTRACOMPANY = ["paskr"];

const CHARGEBEE_CUTOVER: Record<string, string> = {
  flex: "2026-08-01",
  go: "2026-10-01",
};

export type CustomerInvoices = {
  customer: string;
  owner: string;
  status: "Active" | "Churned";
  totalOutstanding: number;
  mostRecentDate: string;
  invoices: OutstandingInvoice[];
};

export async function GET(request: NextRequest) {
  const entity = request.nextUrl.searchParams.get("entity") || "flex";
  const isChargebee = entity === "cb-flex";
  const qboEntity = isChargebee ? "flex" : entity;
  const realmId = REALMS[qboEntity];

  if (!realmId) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  try {
    const [ownerMap, churnData] = await Promise.all([
      getCompanyOwners(),
      supabaseAdmin
        .from("hubspot_report_cache")
        .select("rows")
        .eq("report_type", "churn")
        .single()
        .then((r) => r.data?.rows as { company?: string; dealname?: string }[] || []),
    ]);

    let rawInvoices: OutstandingInvoice[];

    if (isChargebee) {
      rawInvoices = await fetchChargebeeOutstandingInvoices();
    } else {
      const chargebeeCutover = CHARGEBEE_CUTOVER[entity];
      const qboInvoices = await fetchOutstandingInvoices(realmId);
      rawInvoices = qboInvoices.filter((inv) => {
        if (chargebeeCutover && inv.txnDate >= chargebeeCutover) return false;
        return true;
      });
    }

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const NOISE = new Set(["the", "a", "an", "and", "of", "inc", "llc", "corp", "co", "ltd", "group", "construction", "services", "service", "company", "builders", "building", "steel", "peak", "eagle", "general", "national", "american", "united", "commercial", "city", "works"]);
    const firstDistinctWord = (s: string) => {
      const words = normalize(s).split(" ");
      return words.find((w) => w.length > 2 && !NOISE.has(w)) || "";
    };

    const ownerByNormalized = new Map<string, string>();
    for (const [name, owner] of ownerMap) {
      ownerByNormalized.set(normalize(name), owner);
    }

    const hsFirstWords = new Map<string, string[]>();
    for (const [name, owner] of ownerMap) {
      const fw = firstDistinctWord(name);
      if (!fw) continue;
      const existing = hsFirstWords.get(fw) || [];
      existing.push(owner);
      hsFirstWords.set(fw, existing);
    }

    function findOwner(customer: string): string {
      const exact = ownerMap.get(customer);
      if (exact) return exact;
      const norm = normalize(customer);
      const byNorm = ownerByNormalized.get(norm);
      if (byNorm) return byNorm;
      for (const [hsName, owner] of ownerByNormalized) {
        if (norm.includes(hsName) || hsName.includes(norm)) return owner;
      }
      const fw = firstDistinctWord(customer);
      if (fw) {
        const matches = hsFirstWords.get(fw);
        if (matches && matches.length === 1) return matches[0];
      }
      return "";
    }

    const churnNormalized = new Set<string>();
    const churnFirstWords = new Map<string, number>();
    for (const deal of churnData) {
      const name = deal.company || deal.dealname || "";
      if (!name) continue;
      churnNormalized.add(normalize(name));
      const fw = firstDistinctWord(name);
      if (fw) churnFirstWords.set(fw, (churnFirstWords.get(fw) || 0) + 1);
    }

    function isChurned(customer: string): boolean {
      const norm = normalize(customer);
      if (churnNormalized.has(norm)) return true;
      for (const cn of churnNormalized) {
        if (norm.includes(cn) || cn.includes(norm)) return true;
      }
      const fw = firstDistinctWord(customer);
      if (fw && churnFirstWords.get(fw) === 1) {
        for (const deal of churnData) {
          const dealName = deal.company || deal.dealname || "";
          if (firstDistinctWord(dealName) === fw) return true;
        }
      }
      return false;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const byCustomer = new Map<string, OutstandingInvoice[]>();
    for (const inv of rawInvoices) {
      if (INTRACOMPANY.some((ic) => inv.customer.toLowerCase().includes(ic))) continue;
      if (!isChargebee && inv.txnDate > cutoffStr) continue;
      if (isChargebee && (inv.txnDate === "2026-09-24" || inv.txnDate === "2026-09-25")) continue;
      const existing = byCustomer.get(inv.customer) || [];
      existing.push(inv);
      byCustomer.set(inv.customer, existing);
    }

    const customers: CustomerInvoices[] = Array.from(byCustomer.entries())
      .map(([customer, invs]) => {
        const sorted = invs.sort((a, b) => b.txnDate.localeCompare(a.txnDate));
        return {
          customer,
          owner: findOwner(customer),
          status: isChurned(customer) ? "Churned" as const : "Active" as const,
          totalOutstanding: invs.reduce((sum, i) => sum + i.balance, 0),
          mostRecentDate: sorted[0]?.txnDate || "",
          invoices: sorted,
        };
      })
      .sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));

    return NextResponse.json({
      customers,
      totalOutstanding: customers.reduce((sum, c) => sum + c.totalOutstanding, 0),
      customerCount: customers.length,
      invoiceCount: customers.reduce((sum, c) => sum + c.invoices.length, 0),
    });
  } catch (err) {
    console.error("Invoice fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
