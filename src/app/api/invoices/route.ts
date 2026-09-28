import { NextRequest, NextResponse } from "next/server";
import { fetchOutstandingInvoices, type OutstandingInvoice } from "@/lib/qbo";
import { getCompanyOwners } from "@/lib/hubspot";

const REALMS: Record<string, string> = {
  flex: "1223699155",
  go: "791016560",
};

const INTRACOMPANY = ["paskr"];

export type CustomerInvoices = {
  customer: string;
  owner: string;
  totalOutstanding: number;
  mostRecentDate: string;
  invoices: OutstandingInvoice[];
};

export async function GET(request: NextRequest) {
  const entity = request.nextUrl.searchParams.get("entity") || "flex";
  const realmId = REALMS[entity];
  if (!realmId) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  try {
    const [invoices, ownerMap] = await Promise.all([
      fetchOutstandingInvoices(realmId),
      getCompanyOwners(),
    ]);

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const NOISE = new Set(["the", "a", "an", "and", "of", "inc", "llc", "corp", "co", "ltd", "group", "construction", "services", "service", "company", "builders", "building"]);
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

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const byCustomer = new Map<string, OutstandingInvoice[]>();
    for (const inv of invoices) {
      if (INTRACOMPANY.some((ic) => inv.customer.toLowerCase().includes(ic))) continue;
      if (inv.txnDate > cutoffStr) continue;
      if (entity === "flex" && inv.txnDate >= "2026-08-01" && inv.txnDate < "2026-09-01") continue;
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
