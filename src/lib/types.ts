export type Entity = "RTS" | "PASKR" | "RTP" | "All";

export type QboToken = {
  id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
};

export type TrialBalanceSnapshot = {
  id: string;
  year_month: string;
  entity: string;
  realm_id: string;
  synced_at: string;
};

export type TrialBalanceRow = {
  id: string;
  snapshot_id: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  net_amount: number;
};

export type HsRevenueSummary = {
  id: string;
  year_month: string;
  deals_won: number;
  total_revenue: number;
  total_arr: number;
  synced_at: string;
};

export type VarianceRow = {
  account_name: string;
  account_type: string;
  current_net: number;
  prior_net: number;
  variance_amount: number;
  variance_pct: number | null;
  flag: "normal" | "warning" | "alert" | "zero_expected";
};
