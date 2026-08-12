const HUBSPOT_BASE = "https://api.hubapi.com";

function getToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
  return token;
}

async function hubspotFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

interface CrmRecord {
  id: string;
  properties: Record<string, string | null>;
}

interface SearchResponse {
  total: number;
  results: CrmRecord[];
  paging?: { next?: { after: string } };
}

interface AssocResult {
  from: { id: string };
  to: { toObjectId: number }[];
}

interface OwnerRecord {
  id: string;
  firstName: string;
  lastName: string;
}

async function searchAll(
  objectType: string,
  filterGroups: unknown[],
  properties: string[],
): Promise<CrmRecord[]> {
  const all: CrmRecord[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = { filterGroups, properties, limit: 100 };
    if (after) body.after = after;

    const data = await hubspotFetch<SearchResponse>(
      `/crm/v3/objects/${objectType}/search`,
      { method: "POST", body: JSON.stringify(body) },
    );

    all.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return all;
}

async function getOwnerMap(): Promise<Map<string, string>> {
  const data = await hubspotFetch<{ results: OwnerRecord[] }>(
    "/crm/v3/owners?limit=500",
  );
  const map = new Map<string, string>();
  for (const o of data.results) {
    map.set(o.id, `${o.firstName} ${o.lastName}`.trim());
  }
  return map;
}

async function getCompanyNames(dealIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (dealIds.length === 0) return map;

  const companyIdsByDeal = new Map<string, string>();

  for (let i = 0; i < dealIds.length; i += 100) {
    const batch = dealIds.slice(i, i + 100);
    const data = await hubspotFetch<{ results: AssocResult[] }>(
      "/crm/v4/associations/deals/companies/batch/read",
      { method: "POST", body: JSON.stringify({ inputs: batch.map((id) => ({ id })) }) },
    );
    for (const r of data.results) {
      if (r.to?.length > 0) {
        companyIdsByDeal.set(r.from.id, String(r.to[0].toObjectId));
      }
    }
  }

  const uniqueIds = [...new Set(companyIdsByDeal.values())];
  const companyNames = new Map<string, string>();

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100);
    const data = await hubspotFetch<{ results: CrmRecord[] }>(
      "/crm/v3/objects/companies/batch/read",
      {
        method: "POST",
        body: JSON.stringify({ inputs: batch.map((id) => ({ id })), properties: ["name"] }),
      },
    );
    for (const c of data.results) {
      companyNames.set(c.id, c.properties.name || "");
    }
  }

  for (const [dealId, companyId] of companyIdsByDeal) {
    const name = companyNames.get(companyId);
    if (name) map.set(dealId, name);
  }

  return map;
}

function getCutoffDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

type Row = Record<string, string | null>;

async function enrichDeals(
  deals: CrmRecord[],
): Promise<{ ownerMap: Map<string, string>; companyMap: Map<string, string> }> {
  const [ownerMap, companyMap] = await Promise.all([
    getOwnerMap(),
    getCompanyNames(deals.map((d) => d.id)),
  ]);
  return { ownerMap, companyMap };
}

export async function syncChurnDeals(): Promise<Row[]> {
  const cutoff = getCutoffDate();
  const deals = await searchAll("deals", [
    {
      filters: [
        { propertyName: "pipeline", operator: "EQ", value: "29808529" },
        { propertyName: "dealstage", operator: "EQ", value: "68147456" },
        { propertyName: "closedate", operator: "GTE", value: cutoff },
      ],
    },
  ], [
    "dealname", "product_owned", "closedate", "renewal_date_",
    "expiring_arr", "churn_reason", "secondary_churn_reason",
    "churn_detail", "market_segment_dropdown", "pandadocs__billing_frequency",
    "pandadocs__term_in_years", "product_gap_s_", "hubspot_owner_id",
  ]);

  const { ownerMap, companyMap } = await enrichDeals(deals);

  return deals.map((d) => ({
    dealname: d.properties.dealname,
    company: companyMap.get(d.id) || null,
    owner: ownerMap.get(d.properties.hubspot_owner_id || "") || null,
    product_owned: d.properties.product_owned,
    closedate: d.properties.closedate,
    renewal_date: d.properties.renewal_date_,
    expiring_arr: d.properties.expiring_arr,
    churn_reason: d.properties.churn_reason,
    secondary_churn_reason: d.properties.secondary_churn_reason,
    churn_detail: d.properties.churn_detail,
    market_segment: d.properties.market_segment_dropdown,
    billing_frequency: d.properties.pandadocs__billing_frequency,
    term_years: d.properties.pandadocs__term_in_years,
    product_gaps: d.properties.product_gap_s_,
  }));
}

export async function syncRenewalDeals(): Promise<Row[]> {
  const cutoff = getCutoffDate();
  const deals = await searchAll("deals", [
    {
      filters: [
        { propertyName: "pipeline", operator: "EQ", value: "29808529" },
        { propertyName: "dealstage", operator: "EQ", value: "68147385" },
        { propertyName: "closedate", operator: "GTE", value: cutoff },
      ],
    },
  ], [
    "dealname", "hubspot_owner_id", "closedate", "renewal_date_",
    "expiring_arr", "hs_arr", "hs_manual_forecast_category",
    "hs_forecast_amount", "pandadocs__billing_frequency",
    "pandadocs__term_in_years", "pandadocs__subscription_start_date",
    "pandadocs__subscription_renewal_date", "product_owned",
  ]);

  const { ownerMap, companyMap } = await enrichDeals(deals);

  return deals.map((d) => ({
    dealname: d.properties.dealname,
    company: companyMap.get(d.id) || null,
    owner: ownerMap.get(d.properties.hubspot_owner_id || "") || null,
    product_owned: d.properties.product_owned,
    closedate: d.properties.closedate,
    renewal_date: d.properties.renewal_date_,
    expiring_arr: d.properties.expiring_arr,
    arr: d.properties.hs_arr,
    forecast_category: d.properties.hs_manual_forecast_category,
    forecast_amount: d.properties.hs_forecast_amount,
    billing_frequency: d.properties.pandadocs__billing_frequency,
    term_years: d.properties.pandadocs__term_in_years,
    sub_start_date: d.properties.pandadocs__subscription_start_date,
    sub_renewal_date: d.properties.pandadocs__subscription_renewal_date,
  }));
}

export async function syncBookingsDeals(): Promise<Row[]> {
  const cutoff = getCutoffDate();
  const deals = await searchAll("deals", [
    {
      filters: [
        { propertyName: "pipeline", operator: "EQ", value: "default" },
        { propertyName: "dealstage", operator: "EQ", value: "closedwon" },
        { propertyName: "closedate", operator: "GTE", value: cutoff },
      ],
    },
  ], [
    "dealname", "closedate", "amount", "hs_arr", "hs_tcv",
    "dealtype", "product_owned", "pandadocs__billing_frequency",
    "pandadocs__term_in_years", "hubspot_owner_id",
    "pandadocs__subscription_start_date", "pandadocs__subscription_renewal_date",
    "acv",
  ]);

  const { ownerMap, companyMap } = await enrichDeals(deals);

  return deals.map((d) => ({
    dealname: d.properties.dealname,
    company: companyMap.get(d.id) || null,
    closedate: d.properties.closedate,
    amount: d.properties.amount,
    arr: d.properties.hs_arr,
    tcv: d.properties.hs_tcv,
    deal_type: d.properties.dealtype,
    product_owned: d.properties.product_owned,
    billing_frequency: d.properties.pandadocs__billing_frequency,
    term_years: d.properties.pandadocs__term_in_years,
    owner: ownerMap.get(d.properties.hubspot_owner_id || "") || null,
    sub_start_date: d.properties.pandadocs__subscription_start_date,
    sub_renewal_date: d.properties.pandadocs__subscription_renewal_date,
    booked_apv: d.properties.acv,
  }));
}

export async function syncArrStack(): Promise<Row[]> {
  const companies = await searchAll("companies", [
    {
      filters: [
        { propertyName: "paying_client", operator: "EQ", value: "Yes" },
      ],
    },
  ], [
    "name", "revenue_band", "active_pricing_plan", "payment_frequency",
    "client_start_date", "company_apv", "booked_arr", "csm_owner",
    "city", "state", "client_health_phase", "client_health_status__rich_text_",
    "arr_segment", "customer_segment", "flex_subscription",
    "go_subscription", "fieldlens_subscription", "teamplayer_subscription",
    "booked_apv",
  ]);

  return companies.map((c) => ({
    name: c.properties.name,
    revenue_band: c.properties.revenue_band,
    pricing_plan: c.properties.active_pricing_plan,
    payment_frequency: c.properties.payment_frequency,
    client_start_date: c.properties.client_start_date,
    company_apv: c.properties.company_apv,
    subscription_arr: c.properties.booked_arr,
    csm_owner: c.properties.csm_owner,
    city: c.properties.city,
    state: c.properties.state,
    health_phase: c.properties.client_health_phase,
    health_status: c.properties.client_health_status__rich_text_,
    arr_segment: c.properties.arr_segment,
    client_segment: c.properties.customer_segment,
    flex: c.properties.flex_subscription,
    go: c.properties.go_subscription,
    fieldlens: c.properties.fieldlens_subscription,
    teamplayer: c.properties.teamplayer_subscription,
    booked_apv: c.properties.booked_apv,
  }));
}
