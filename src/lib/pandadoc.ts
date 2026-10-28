import { supabaseAdmin } from "./supabase-server";

export type PandaDocContract = {
  id: string;
  name: string;
  company: string;
  status: string;
  dateCompleted: string;
  billingFrequency: string;
  pricingPlan: string;
  tcv: number;
  termYears: string;
  startDate: string;
  renewalDate: string;
  lineItems: {
    name: string;
    sku: string;
    price: number;
    qty: number;
    billingFrequency: string;
    contractTerm: string;
    total: number;
  }[];
};

export async function fetchPandaDocContracts(): Promise<PandaDocContract[]> {
  const { data, error } = await supabaseAdmin
    .from("hubspot_report_cache")
    .select("rows")
    .eq("report_type", "pandadoc-contracts")
    .single();

  if (error || !data?.rows) {
    throw new Error(
      "PandaDoc contract cache is empty. Run a sync from the Contract Audit page to populate it.",
    );
  }

  return data.rows as PandaDocContract[];
}
