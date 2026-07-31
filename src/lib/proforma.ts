export const QUARTERLY_DEAL_DATA = [
  {
    quarter: "2024-Q1",
    new_business_arr: 389847, new_business_count: 29,
    renewal_arr: 0, renewal_count: 0, expiring_arr: 0,
    expansion_arr: 0, expansion_count: 0,
    churned_arr: 465564, churned_count: 48,
    total_closed_arr: 389847, total_closed_count: 29,
  },
  {
    quarter: "2024-Q2",
    new_business_arr: 290059, new_business_count: 25,
    renewal_arr: 0, renewal_count: 0, expiring_arr: 0,
    expansion_arr: 0, expansion_count: 0,
    churned_arr: 240636, churned_count: 21,
    total_closed_arr: 290059, total_closed_count: 25,
  },
  {
    quarter: "2024-Q3",
    new_business_arr: 290683, new_business_count: 22,
    renewal_arr: 0, renewal_count: 0, expiring_arr: 0,
    expansion_arr: 0, expansion_count: 0,
    churned_arr: 389164, churned_count: 36,
    total_closed_arr: 290683, total_closed_count: 22,
  },
  {
    quarter: "2024-Q4",
    new_business_arr: 388236, new_business_count: 29,
    renewal_arr: 0, renewal_count: 0, expiring_arr: 0,
    expansion_arr: 0, expansion_count: 0,
    churned_arr: 502333, churned_count: 41,
    total_closed_arr: 388236, total_closed_count: 29,
  },
  {
    quarter: "2025-Q1",
    new_business_arr: 236937, new_business_count: 15,
    renewal_arr: 1328095, renewal_count: 0, expiring_arr: 1753003,
    expansion_arr: 90095, expansion_count: 0,
    churned_arr: 424908, churned_count: 29,
    total_closed_arr: 1655127, total_closed_count: 15,
  },
  {
    quarter: "2025-Q2",
    new_business_arr: 303127, new_business_count: 27,
    renewal_arr: 1307933, renewal_count: 0, expiring_arr: 1652940,
    expansion_arr: 67950, expansion_count: 0,
    churned_arr: 345007, churned_count: 23,
    total_closed_arr: 1679010, total_closed_count: 27,
  },
  {
    quarter: "2025-Q3",
    new_business_arr: 343876, new_business_count: 31,
    renewal_arr: 1213245, renewal_count: 0, expiring_arr: 1551781,
    expansion_arr: 127643, expansion_count: 0,
    churned_arr: 338536, churned_count: 25,
    total_closed_arr: 1684764, total_closed_count: 31,
  },
  {
    quarter: "2025-Q4",
    new_business_arr: 390720, new_business_count: 0,
    renewal_arr: 1572344, renewal_count: 0, expiring_arr: 2094220,
    expansion_arr: 159658, expansion_count: 0,
    churned_arr: 521876, churned_count: 0,
    total_closed_arr: 2122722, total_closed_count: 0,
  },
  {
    quarter: "2026-Q1",
    new_business_arr: 270026, new_business_count: 21,
    renewal_arr: 1788364, renewal_count: 0, expiring_arr: 2181000,
    expansion_arr: 217217, expansion_count: 0,
    churned_arr: 392636, churned_count: 0,
    total_closed_arr: 2275607, total_closed_count: 21,
  },
  {
    quarter: "2026-Q2",
    new_business_arr: 234261, new_business_count: 19,
    renewal_arr: 1501354, renewal_count: 0, expiring_arr: 1831000,
    expansion_arr: 175923, expansion_count: 0,
    churned_arr: 329646, churned_count: 0,
    total_closed_arr: 1911538, total_closed_count: 19,
  },
];

export const PNL_SEED_DATA = [
  {
    quarter: "2026-Q1",
    revenue: 1940431, cogs: 660633, gross_profit: 1279798,
    operating_expenses: 2388060, sm_expenses: 798583,
    net_income: -1525897, interest: 8817, taxes: 153,
    depreciation_amortization: 426607, ebitda: -1108261,
  },
  {
    quarter: "2026-Q2",
    revenue: 1851958, cogs: 598023, gross_profit: 1253934,
    operating_expenses: 2145811, sm_expenses: 741930,
    net_income: -1291900, interest: 6058, taxes: 19638,
    depreciation_amortization: 425720, ebitda: -891876,
  },
];

export type ProformaDeal = (typeof QUARTERLY_DEAL_DATA)[number];
export type ProformaPnl = (typeof PNL_SEED_DATA)[number];
