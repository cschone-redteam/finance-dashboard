const CHARGEBEE_SITE = "redteam";
const CHARGEBEE_BASE = `https://${CHARGEBEE_SITE}.chargebee.com/api/v2`;

function getApiKey(): string {
  const key = process.env.CHARGEBEE_API_KEY;
  if (!key) throw new Error("CHARGEBEE_API_KEY is not configured");
  return key;
}

function authHeader(): string {
  return "Basic " + Buffer.from(getApiKey() + ":").toString("base64");
}

interface ChargebeeInvoice {
  id: string;
  customer_id: string;
  status: string;
  date: number;
  due_date: number;
  total: number;
  amount_due: number;
  currency_code: string;
}

interface ChargebeeCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  email?: string;
}

interface ChargebeeListResponse<T> {
  list: { invoice?: T; customer?: T }[];
  next_offset?: string;
}

async function chargebeeFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<ChargebeeListResponse<T>> {
  const url = new URL(`${CHARGEBEE_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chargebee API ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

async function listAllInvoices(
  params: Record<string, string>
): Promise<ChargebeeInvoice[]> {
  const all: ChargebeeInvoice[] = [];
  let offset: string | undefined;

  do {
    const query: Record<string, string> = { ...params, limit: "100" };
    if (offset) query.offset = offset;

    const data = await chargebeeFetch<ChargebeeInvoice>("/invoices", query);
    for (const item of data.list) {
      if (item.invoice) all.push(item.invoice);
    }
    offset = data.next_offset;
  } while (offset);

  return all;
}

async function getCustomerMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let offset: string | undefined;

  do {
    const params: Record<string, string> = { limit: "100" };
    if (offset) params.offset = offset;

    const data = await chargebeeFetch<ChargebeeCustomer>("/customers", params);
    for (const item of data.list) {
      const c = item.customer;
      if (!c) continue;
      const name =
        c.company ||
        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
        c.id;
      map.set(c.id, name);
    }
    offset = data.next_offset;
  } while (offset);

  return map;
}

export type ChargebeeOutstandingInvoice = {
  customer: string;
  invoiceNumber: string;
  txnDate: string;
  dueDate: string;
  balance: number;
  totalAmt: number;
};

function epochToDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

export async function fetchChargebeeMonthlyBillings(
  year: number,
): Promise<Record<string, number>> {
  const startEpoch = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
  const endEpoch = Math.floor(new Date(`${year + 1}-01-01T00:00:00Z`).getTime() / 1000);

  const invoices = await listAllInvoices({
    "date[after]": startEpoch.toString(),
    "date[before]": endEpoch.toString(),
    "status[in]": "[paid,payment_due,posted]",
    "sort_by[asc]": "date",
  });

  const monthly: Record<string, number> = {};
  for (const inv of invoices) {
    const d = new Date(inv.date * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[key] = (monthly[key] || 0) + inv.total / 100;
  }
  return monthly;
}

export type ChargebeeSubscription = {
  id: string;
  customer_id: string;
  customer: string;
  plan_id: string;
  plan_amount: number;
  status: string;
  billing_period: number;
  billing_period_unit: string;
  mrr: number;
  current_term_start: string;
  current_term_end: string;
  items: {
    item_price_id: string;
    item_type: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
};

interface ChargebeeRawSubscription {
  id: string;
  customer_id: string;
  plan_id?: string;
  plan_amount?: number;
  plan_unit_price?: number;
  plan_quantity?: number;
  status: string;
  billing_period?: number;
  billing_period_unit?: string;
  mrr?: number;
  current_term_start?: number;
  current_term_end?: number;
  subscription_items?: {
    item_price_id: string;
    item_type: string;
    quantity?: number;
    unit_price?: number;
    amount?: number;
  }[];
}

async function listAllSubscriptions(
  params: Record<string, string>
): Promise<ChargebeeRawSubscription[]> {
  const all: ChargebeeRawSubscription[] = [];
  let offset: string | undefined;

  do {
    const query: Record<string, string> = { ...params, limit: "100" };
    if (offset) query.offset = offset;

    const url = new URL(`${CHARGEBEE_BASE}/subscriptions`);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: authHeader() },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Chargebee API ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    for (const item of data.list) {
      if (item.subscription) all.push(item.subscription);
    }
    offset = data.next_offset;
  } while (offset);

  return all;
}

export async function fetchChargebeeSubscriptions(): Promise<ChargebeeSubscription[]> {
  const [rawSubs, customerMap] = await Promise.all([
    listAllSubscriptions({ "status[is]": "active" }),
    getCustomerMap(),
  ]);

  return rawSubs.map((sub) => ({
    id: sub.id,
    customer_id: sub.customer_id,
    customer: customerMap.get(sub.customer_id) || sub.customer_id,
    plan_id: sub.plan_id || "",
    plan_amount: (sub.plan_amount || 0) / 100,
    status: sub.status,
    billing_period: sub.billing_period || 1,
    billing_period_unit: sub.billing_period_unit || "month",
    mrr: (sub.mrr || 0) / 100,
    current_term_start: sub.current_term_start ? epochToDate(sub.current_term_start) : "",
    current_term_end: sub.current_term_end ? epochToDate(sub.current_term_end) : "",
    items: (sub.subscription_items || []).map((item) => ({
      item_price_id: item.item_price_id,
      item_type: item.item_type,
      quantity: item.quantity || 1,
      unit_price: (item.unit_price || 0) / 100,
      amount: (item.amount || 0) / 100,
    })),
  }));
}

export async function fetchChargebeeOutstandingInvoices(): Promise<
  ChargebeeOutstandingInvoice[]
> {
  const [invoices, customerMap] = await Promise.all([
    listAllInvoices({
      "status[in]": "[payment_due,not_paid]",
      "sort_by[desc]": "date",
    }),
    getCustomerMap(),
  ]);

  return invoices.map((inv) => ({
    customer: customerMap.get(inv.customer_id) || inv.customer_id,
    invoiceNumber: inv.id,
    txnDate: epochToDate(inv.date),
    dueDate: epochToDate(inv.due_date),
    balance: inv.amount_due / 100,
    totalAmt: inv.total / 100,
  }));
}
