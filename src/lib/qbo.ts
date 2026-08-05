import { supabaseAdmin } from "./supabase-server";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function apiBase(): string {
  const env = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QUICKBOOKS_CLIENT_ID!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
    state,
  });
  return `${QBO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  realmId: string
): Promise<void> {
  const credentials = Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = await res.json();
  const expiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  const { error } = await supabaseAdmin.from("qbo_tokens").upsert(
    {
      realm_id: realmId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    },
    { onConflict: "realm_id" }
  );

  if (error) {
    console.error("Failed to store QBO tokens:", error);
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
}

async function refreshTokenIfNeeded(realmId: string): Promise<string> {
  const { data: token } = await supabaseAdmin
    .from("qbo_tokens")
    .select("*")
    .eq("realm_id", realmId)
    .single();

  if (!token) throw new Error("No QBO token found");

  if (new Date(token.expires_at) > new Date(Date.now() + 60_000)) {
    return token.access_token;
  }

  const credentials = Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }

  const data = await res.json();
  const expiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  await supabaseAdmin
    .from("qbo_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    })
    .eq("realm_id", realmId);

  return data.access_token;
}

export async function fetchTrialBalance(
  realmId: string,
  startDate: string,
  endDate: string
): Promise<QboReportResponse> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/reports/TrialBalance?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function fetchProfitAndLoss(
  realmId: string,
  startDate: string,
  endDate: string
): Promise<QboReportResponse> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/reports/ProfitAndLoss?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API error: ${res.status} ${text}`);
  }

  return res.json();
}

export type ParsedPnLSection = {
  section: string;
  accounts: { name: string; amount: number }[];
  total: number;
};

export function parseProfitAndLossReport(
  report: QboReportResponse
): ParsedPnLSection[] {
  const sections: ParsedPnLSection[] = [];

  for (const row of report.Rows?.Row || []) {
    if (row.Header?.ColData && row.Rows?.Row) {
      const sectionName = row.Header.ColData[0]?.value || "Unknown";
      const accounts: { name: string; amount: number }[] = [];

      for (const subRow of row.Rows.Row) {
        if (subRow.ColData && subRow.ColData.length >= 2 && subRow.type !== "Section") {
          const name = subRow.ColData[0]?.value || "";
          const amount = parseFloat(subRow.ColData[1]?.value || "0") || 0;
          if (name) accounts.push({ name, amount });
        }
        if (subRow.Rows?.Row) {
          for (const innerRow of subRow.Rows.Row) {
            if (innerRow.ColData && innerRow.ColData.length >= 2) {
              const name = innerRow.ColData[0]?.value || "";
              const amount = parseFloat(innerRow.ColData[1]?.value || "0") || 0;
              if (name) accounts.push({ name, amount });
            }
          }
        }
      }

      const summaryAmount = row.Summary?.ColData?.[1]?.value;
      const total = parseFloat(summaryAmount || "0") || 0;
      sections.push({ section: sectionName, accounts, total });
    }
  }

  return sections;
}

export async function queryQbo(
  realmId: string,
  query: string
): Promise<Record<string, unknown>> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO query error: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchClasses(realmId: string): Promise<{ Id: string; Name: string; FullyQualifiedName: string; Active: boolean }[]> {
  const result = await queryQbo(realmId, "SELECT * FROM Class MAXRESULTS 1000");
  const qr = result.QueryResponse as { Class?: { Id: string; Name: string; FullyQualifiedName: string; Active: boolean }[] } | undefined;
  return qr?.Class || [];
}

export async function fetchProfitAndLossByClass(
  realmId: string,
  startDate: string,
  endDate: string,
  classId: string
): Promise<QboReportResponse> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    class: classId,
  });

  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/reports/ProfitAndLoss?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function fetchBalanceSheet(
  realmId: string,
  startDate: string,
  endDate: string
): Promise<QboReportResponse> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/reports/BalanceSheet?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API error: ${res.status} ${text}`);
  }

  return res.json();
}

export function parseBalanceSheetReport(
  report: QboReportResponse
): ParsedPnLSection[] {
  const sections: ParsedPnLSection[] = [];

  function walkSection(row: QboRow, parentName: string) {
    const sectionName = row.Header?.ColData?.[0]?.value || parentName;
    const accounts: { name: string; amount: number }[] = [];

    if (row.Rows?.Row) {
      for (const subRow of row.Rows.Row) {
        if (subRow.Header?.ColData && subRow.Rows?.Row) {
          walkSection(subRow, sectionName);
        } else if (subRow.ColData && subRow.ColData.length >= 2 && subRow.type !== "Section") {
          const name = subRow.ColData[0]?.value || "";
          const amount = parseFloat(subRow.ColData[1]?.value || "0") || 0;
          if (name) accounts.push({ name, amount });
        }
      }
    }

    const summaryAmount = row.Summary?.ColData?.[1]?.value;
    const total = parseFloat(summaryAmount || "0") || 0;

    if (accounts.length > 0 || total !== 0) {
      sections.push({ section: sectionName, accounts, total });
    }
  }

  for (const row of report.Rows?.Row || []) {
    if (row.Header?.ColData && row.Rows?.Row) {
      walkSection(row, "Unknown");
    }
  }

  return sections;
}

export async function fetchAgedReceivables(
  realmId: string,
  reportDate: string
): Promise<QboReportResponse> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const params = new URLSearchParams({
    report_date: reportDate,
    aging_method: "Report_Date",
  });

  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/reports/AgedReceivableDetail?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API error: ${res.status} ${text}`);
  }

  return res.json();
}

export type ParsedArAgingRow = {
  customer: string;
  transaction_type: string;
  transaction_date: string;
  due_date: string;
  num: string;
  amount: number;
  open_balance: number;
  days_past_due: number;
};

export function parseAgedReceivablesReport(
  report: QboReportResponse
): ParsedArAgingRow[] {
  const rows: ParsedArAgingRow[] = [];
  const columns = report.Columns?.Column?.map((c) => c.ColTitle) || [];

  function findColIdx(search: string): number {
    return columns.findIndex((c) => c.toLowerCase().includes(search.toLowerCase()));
  }

  const customerIdx = findColIdx("Customer");
  const txTypeIdx = findColIdx("Transaction Type");
  const dateIdx = findColIdx("Date");
  const numIdx = findColIdx("Num");
  const dueDateIdx = findColIdx("Due Date");
  const amountIdx = findColIdx("Amount");
  const balanceIdx = findColIdx("Open Balance");

  function walkRows(qboRows: QboRow[]) {
    for (const row of qboRows) {
      if (row.Rows?.Row) {
        walkRows(row.Rows.Row);
      }
      if (row.ColData && row.ColData.length >= 2 && row.type === "Data") {
        const openBalance = parseFloat(row.ColData[balanceIdx]?.value || "0") || 0;
        if (openBalance === 0) continue;

        const customer = customerIdx >= 0
          ? (row.ColData[customerIdx]?.value || "Unknown")
          : "Unknown";
        const txDate = dateIdx >= 0 ? (row.ColData[dateIdx]?.value || "") : "";
        const dueDate = dueDateIdx >= 0 ? (row.ColData[dueDateIdx]?.value || "") : "";

        let daysPastDue = 0;
        if (dueDate) {
          const due = new Date(dueDate);
          const now = new Date();
          daysPastDue = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
        }

        rows.push({
          customer,
          transaction_type: txTypeIdx >= 0 ? (row.ColData[txTypeIdx]?.value || "") : "",
          transaction_date: txDate,
          due_date: dueDate,
          num: numIdx >= 0 ? (row.ColData[numIdx]?.value || "") : "",
          amount: amountIdx >= 0 ? (parseFloat(row.ColData[amountIdx]?.value || "0") || 0) : 0,
          open_balance: openBalance,
          days_past_due: daysPastDue,
        });
      }
    }
  }

  if (report.Rows?.Row) {
    walkRows(report.Rows.Row);
  }

  return rows;
}

export async function fetchCustomerCount(realmId: string): Promise<number> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const query = encodeURIComponent("SELECT COUNT(*) FROM Customer WHERE Active = true");
  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/query?query=${query}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return data.QueryResponse?.totalCount ?? 0;
}

export async function fetchMonthlyReceipts(realmId: string): Promise<number> {
  const accessToken = await refreshTokenIfNeeded(realmId);
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const query = encodeURIComponent(
    `SELECT * FROM Payment WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
  );
  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/query?query=${query}&maxresults=1000`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) return 0;
  const data = await res.json();
  const payments = data.QueryResponse?.Payment || [];
  return payments.reduce((sum: number, p: { TotalAmt?: number }) => sum + (p.TotalAmt || 0), 0);
}

export async function getConnectedRealm(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("qbo_tokens")
    .select("realm_id")
    .limit(1)
    .single();
  return data?.realm_id ?? null;
}

export async function getAllConnectedRealms(): Promise<{ realm_id: string; created_at: string }[]> {
  const { data } = await supabaseAdmin
    .from("qbo_tokens")
    .select("realm_id, created_at")
    .order("created_at");
  return data || [];
}

// QBO Report JSON types
type QboColDesc = { ColTitle: string; ColType: string };
type QboCellValue = { value?: string; id?: string };
type QboRow = {
  type?: string;
  ColData?: QboCellValue[];
  group?: string;
  Summary?: { ColData: QboCellValue[] };
  Rows?: { Row: QboRow[] };
  Header?: { ColData: QboCellValue[] };
};
type QboReportResponse = {
  Header: { ReportName: string; StartPeriod: string; EndPeriod: string };
  Columns: { Column: QboColDesc[] };
  Rows: { Row: QboRow[] };
};

export type ParsedTBRow = {
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  net_amount: number;
};

export function parseTrialBalanceReport(
  report: QboReportResponse
): ParsedTBRow[] {
  const rows: ParsedTBRow[] = [];

  function walkRows(qboRows: QboRow[], currentType: string) {
    for (const row of qboRows) {
      if (row.Header?.ColData) {
        const typeName = row.Header.ColData[0]?.value || currentType;
        if (row.Rows?.Row) {
          walkRows(row.Rows.Row, typeName);
        }
      } else if (row.ColData && row.ColData.length >= 3) {
        const accountName = row.ColData[0]?.value || "";
        const debit = parseFloat(row.ColData[1]?.value || "0") || 0;
        const credit = parseFloat(row.ColData[2]?.value || "0") || 0;

        if (accountName && accountName !== "" && row.type !== "Section") {
          rows.push({
            account_name: accountName,
            account_type: currentType,
            debit,
            credit,
            net_amount: debit - credit,
          });
        }
      }
    }
  }

  if (report.Rows?.Row) {
    walkRows(report.Rows.Row, "Unknown");
  }

  return rows;
}
