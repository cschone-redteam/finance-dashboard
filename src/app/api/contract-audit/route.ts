import { NextResponse } from "next/server";
import { fetchChargebeeSubscriptions, type ChargebeeSubscription } from "@/lib/chargebee";
import { fetchPandaDocContracts, type PandaDocContract } from "@/lib/pandadoc";

type LineComparison = {
  product: string;
  pandadocPrice: number | null;
  chargebeePrice: number | null;
  priceVariance: number;
  pandadocFrequency: string;
  chargebeeFrequency: string;
  frequencyMatch: boolean;
};

export type ContractComparison = {
  company: string;
  pandadocContract: string | null;
  pandadocTcv: number | null;
  pandadocBillingFrequency: string;
  pandadocPricingPlan: string;
  pandadocStartDate: string;
  pandadocRenewalDate: string;
  chargebeeSubscriptionId: string | null;
  chargebeeAmount: number | null;
  chargebeeBillingFrequency: string;
  chargebeeTermStart: string;
  chargebeeTermEnd: string;
  chargebeeMrr: number;
  amountVariance: number;
  billingFrequencyMatch: boolean;
  lineComparisons: LineComparison[];
  status: "match" | "variance" | "pandadoc-only" | "chargebee-only";
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE = new Set([
  "the", "a", "an", "and", "of", "inc", "llc", "corp", "co", "ltd",
  "group", "construction", "services", "service", "company", "builders",
  "building", "enterprises", "enterprise",
]);

function stripNoise(s: string): string {
  return normalize(s)
    .split(" ")
    .filter((w) => !NOISE.has(w))
    .join(" ");
}

function matchCompanies(pdCompany: string, cbCompany: string): boolean {
  const a = stripNoise(pdCompany);
  const b = stripNoise(cbCompany);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  if (aWords[0] && bWords[0] && aWords[0] === bWords[0] && aWords[0].length > 3) return true;
  return false;
}

function normalizeBillingFrequency(freq: string): string {
  const f = freq.toLowerCase().trim();
  if (f.includes("semiannual") || f.includes("semi-annual")) return "semiannually";
  if (f.includes("annual") || f.includes("year")) return "annually";
  if (f.includes("month")) return "monthly";
  if (f.includes("quarter")) return "quarterly";
  return f;
}

function annualize(amount: number, frequency: string): number {
  const f = normalizeBillingFrequency(frequency);
  if (f === "monthly") return amount * 12;
  if (f === "quarterly") return amount * 4;
  if (f === "semiannually") return amount * 2;
  return amount;
}

function chargebeeBillingLabel(sub: ChargebeeSubscription): string {
  const unit = sub.billing_period_unit.toLowerCase();
  if (sub.billing_period === 1 && unit === "year") return "Annually";
  if (sub.billing_period === 1 && unit === "month") return "Monthly";
  if (sub.billing_period === 3 && unit === "month") return "Quarterly";
  return `Every ${sub.billing_period} ${sub.billing_period_unit}s`;
}

type ChargebeeGroup = {
  customer: string;
  subscriptions: ChargebeeSubscription[];
  totalAmount: number;
  totalMrr: number;
  primaryBillingFrequency: string;
  allItems: ChargebeeSubscription["items"];
};

function groupChargebeeByCustomer(subs: ChargebeeSubscription[]): ChargebeeGroup[] {
  const byCustomer = new Map<string, ChargebeeSubscription[]>();
  for (const sub of subs) {
    const key = sub.customer;
    const existing = byCustomer.get(key) || [];
    existing.push(sub);
    byCustomer.set(key, existing);
  }

  return Array.from(byCustomer.entries()).map(([customer, customerSubs]) => {
    const allItems = customerSubs.flatMap((s) => s.items);
    const totalAmount = customerSubs.reduce((sum, s) => {
      const subAmount = s.items.reduce((a, i) => a + i.amount, 0) || s.plan_amount;
      return sum + subAmount;
    }, 0);
    const totalMrr = customerSubs.reduce((sum, s) => sum + s.mrr, 0);
    const primary = customerSubs[0];
    return {
      customer,
      subscriptions: customerSubs,
      totalAmount,
      totalMrr,
      primaryBillingFrequency: chargebeeBillingLabel(primary),
      allItems,
    };
  });
}

function compareLineItems(
  pdContract: PandaDocContract,
  cbGroup: ChargebeeGroup,
): LineComparison[] {
  const comparisons: LineComparison[] = [];
  const matchedCbItems = new Set<number>();

  for (const pdItem of pdContract.lineItems) {
    const pdName = normalize(pdItem.name);
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < cbGroup.allItems.length; i++) {
      if (matchedCbItems.has(i)) continue;
      const cbName = normalize(cbGroup.allItems[i].item_price_id);
      const cbWords = cbName.split(/[-_\s]/);
      const pdWords = pdName.split(/[-_\s]/);
      let overlap = 0;
      for (const w of pdWords) {
        if (w.length > 2 && cbWords.some((cw) => cw.includes(w) || w.includes(cw))) overlap++;
      }
      if (overlap > bestScore) {
        bestScore = overlap;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0 && bestScore > 0) {
      matchedCbItems.add(bestMatch);
      const cbItem = cbGroup.allItems[bestMatch];
      const pdAnnual = annualize(pdItem.total, pdItem.billingFrequency);
      const cbAnnual = annualize(cbItem.amount, cbGroup.primaryBillingFrequency);
      comparisons.push({
        product: pdItem.name,
        pandadocPrice: pdItem.total,
        chargebeePrice: cbItem.amount,
        priceVariance: cbAnnual - pdAnnual,
        pandadocFrequency: pdItem.billingFrequency,
        chargebeeFrequency: cbGroup.primaryBillingFrequency.toLowerCase(),
        frequencyMatch:
          normalizeBillingFrequency(pdItem.billingFrequency) ===
          normalizeBillingFrequency(cbGroup.primaryBillingFrequency),
      });
    } else {
      comparisons.push({
        product: pdItem.name,
        pandadocPrice: pdItem.total,
        chargebeePrice: null,
        priceVariance: 0 - annualize(pdItem.total, pdItem.billingFrequency),
        pandadocFrequency: pdItem.billingFrequency,
        chargebeeFrequency: "",
        frequencyMatch: false,
      });
    }
  }

  for (let i = 0; i < cbGroup.allItems.length; i++) {
    if (matchedCbItems.has(i)) continue;
    const cbItem = cbGroup.allItems[i];
    comparisons.push({
      product: cbItem.item_price_id,
      pandadocPrice: null,
      chargebeePrice: cbItem.amount,
      priceVariance: annualize(cbItem.amount, cbGroup.primaryBillingFrequency),
      pandadocFrequency: "",
      chargebeeFrequency: cbGroup.primaryBillingFrequency.toLowerCase(),
      frequencyMatch: false,
    });
  }

  return comparisons;
}

export async function GET() {
  const errors: string[] = [];
  let subscriptions: ChargebeeSubscription[] = [];
  let contracts: PandaDocContract[] = [];

  try {
    subscriptions = await fetchChargebeeSubscriptions();
  } catch (err) {
    errors.push(`Chargebee: ${err instanceof Error ? err.message : "Failed to fetch"}`);
  }

  try {
    contracts = await fetchPandaDocContracts();
  } catch (err) {
    errors.push(`PandaDoc: ${err instanceof Error ? err.message : "Failed to fetch"}`);
  }

  if (subscriptions.length === 0 && contracts.length === 0) {
    return NextResponse.json({ error: errors.join("; ") || "No data" }, { status: 500 });
  }

  const cbGroups = groupChargebeeByCustomer(subscriptions);
  const comparisons: ContractComparison[] = [];
  const matchedCbCustomers = new Set<string>();

  for (const pd of contracts) {
    let matchedGroup: ChargebeeGroup | null = null;

    for (const group of cbGroups) {
      if (matchedCbCustomers.has(group.customer)) continue;
      if (matchCompanies(pd.company, group.customer)) {
        matchedGroup = group;
        matchedCbCustomers.add(group.customer);
        break;
      }
    }

    const pdBillingFreq = pd.billingFrequency || pd.lineItems[0]?.billingFrequency || "";
    const termYears = parseFloat(pd.termYears) || 1;
    const pdAnnualAmount = pd.tcv / termYears;

    if (matchedGroup) {
      const cbAnnualAmount = annualize(matchedGroup.totalAmount, matchedGroup.primaryBillingFrequency);
      const variance = cbAnnualAmount - pdAnnualAmount;
      const freqMatch =
        normalizeBillingFrequency(pdBillingFreq) ===
        normalizeBillingFrequency(matchedGroup.primaryBillingFrequency);

      comparisons.push({
        company: pd.company,
        pandadocContract: pd.name,
        pandadocTcv: pd.tcv,
        pandadocBillingFrequency: pdBillingFreq,
        pandadocPricingPlan: pd.pricingPlan,
        pandadocStartDate: pd.startDate,
        pandadocRenewalDate: pd.renewalDate,
        chargebeeSubscriptionId: matchedGroup.subscriptions.map((s) => s.id).join(", "),
        chargebeeAmount: matchedGroup.totalAmount,
        chargebeeBillingFrequency: matchedGroup.primaryBillingFrequency,
        chargebeeTermStart: matchedGroup.subscriptions[0]?.current_term_start || "",
        chargebeeTermEnd: matchedGroup.subscriptions[0]?.current_term_end || "",
        chargebeeMrr: matchedGroup.totalMrr,
        amountVariance: variance,
        billingFrequencyMatch: freqMatch,
        lineComparisons: compareLineItems(pd, matchedGroup),
        status: Math.abs(variance) < 1 && freqMatch ? "match" : "variance",
      });
    } else {
      comparisons.push({
        company: pd.company,
        pandadocContract: pd.name,
        pandadocTcv: pd.tcv,
        pandadocBillingFrequency: pdBillingFreq,
        pandadocPricingPlan: pd.pricingPlan,
        pandadocStartDate: pd.startDate,
        pandadocRenewalDate: pd.renewalDate,
        chargebeeSubscriptionId: null,
        chargebeeAmount: null,
        chargebeeBillingFrequency: "",
        chargebeeTermStart: "",
        chargebeeTermEnd: "",
        chargebeeMrr: 0,
        amountVariance: 0,
        billingFrequencyMatch: true,
        lineComparisons: [],
        status: "pandadoc-only",
      });
    }
  }

  for (const group of cbGroups) {
    if (matchedCbCustomers.has(group.customer)) continue;
    comparisons.push({
      company: group.customer,
      pandadocContract: null,
      pandadocTcv: null,
      pandadocBillingFrequency: "",
      pandadocPricingPlan: "",
      pandadocStartDate: "",
      pandadocRenewalDate: "",
      chargebeeSubscriptionId: group.subscriptions.map((s) => s.id).join(", "),
      chargebeeAmount: group.totalAmount,
      chargebeeBillingFrequency: group.primaryBillingFrequency,
      chargebeeTermStart: group.subscriptions[0]?.current_term_start || "",
      chargebeeTermEnd: group.subscriptions[0]?.current_term_end || "",
      chargebeeMrr: group.totalMrr,
      amountVariance: 0,
      billingFrequencyMatch: true,
      lineComparisons: [],
      status: "chargebee-only",
    });
  }

  comparisons.sort((a, b) => Math.abs(b.amountVariance) - Math.abs(a.amountVariance));

  const stats = {
    total: comparisons.length,
    matches: comparisons.filter((c) => c.status === "match").length,
    variances: comparisons.filter((c) => c.status === "variance").length,
    pandadocOnly: comparisons.filter((c) => c.status === "pandadoc-only").length,
    chargebeeOnly: comparisons.filter((c) => c.status === "chargebee-only").length,
    totalVarianceAmount: comparisons
      .filter((c) => c.status === "variance")
      .reduce((s, c) => s + Math.abs(c.amountVariance), 0),
  };

  return NextResponse.json({
    comparisons,
    stats,
    errors: errors.length > 0 ? errors : undefined,
  });
}
