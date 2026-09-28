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
    const query = { ...params, limit: "100" };
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
