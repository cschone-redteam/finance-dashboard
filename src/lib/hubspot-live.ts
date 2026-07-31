// HubSpot closed-won deals by quarter and type — pulled via MCP on 2026-07-23
// Source: default sales pipeline, closed-won deals

export const HUBSPOT_DEAL_DATA = [
  {
    quarter: "2024-Q1",
    new_business_arr: 367887, new_business_count: 26,
    expansion_arr: 12000, expansion_count: 2,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 6000, unassigned_count: 1,
    total_closed_arr: 385887, total_closed_count: 29,
  },
  {
    quarter: "2024-Q2",
    new_business_arr: 234103, new_business_count: 20,
    expansion_arr: 17400, expansion_count: 2,
    crosssell_arr: 23100, crosssell_count: 1,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 0, unassigned_count: 1,
    total_closed_arr: 274603, total_closed_count: 24,
  },
  {
    quarter: "2024-Q3",
    new_business_arr: 287041, new_business_count: 20,
    expansion_arr: 0, expansion_count: 0,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 0, unassigned_count: 4,
    total_closed_arr: 287041, total_closed_count: 24,
  },
  {
    quarter: "2024-Q4",
    new_business_arr: 361628, new_business_count: 26,
    expansion_arr: 24037, expansion_count: 3,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 0, unassigned_count: 0,
    total_closed_arr: 385665, total_closed_count: 29,
  },
  {
    quarter: "2025-Q1",
    new_business_arr: 221961, new_business_count: 16,
    expansion_arr: 0, expansion_count: 0,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 8748, unassigned_count: 1,
    total_closed_arr: 230709, total_closed_count: 17,
  },
  {
    quarter: "2025-Q2",
    new_business_arr: 282727, new_business_count: 26,
    expansion_arr: 0, expansion_count: 0,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 0, unassigned_count: 1,
    total_closed_arr: 282727, total_closed_count: 27,
  },
  {
    quarter: "2025-Q3",
    new_business_arr: 334594, new_business_count: 30,
    expansion_arr: 25626, expansion_count: 2,
    crosssell_arr: 7956, crosssell_count: 1,
    renewal_arr: 0, renewal_count: 1,
    unassigned_arr: 0, unassigned_count: 0,
    total_closed_arr: 368176, total_closed_count: 34,
  },
  {
    quarter: "2025-Q4",
    new_business_arr: 390720, new_business_count: 27,
    expansion_arr: 7998, expansion_count: 1,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 12312, renewal_count: 1,
    unassigned_arr: 0, unassigned_count: 0,
    total_closed_arr: 411030, total_closed_count: 29,
  },
  {
    quarter: "2026-Q1",
    new_business_arr: 274430, new_business_count: 21,
    expansion_arr: 0, expansion_count: 0,
    crosssell_arr: 7956, crosssell_count: 1,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 0, unassigned_count: 0,
    total_closed_arr: 282386, total_closed_count: 22,
  },
  {
    quarter: "2026-Q2",
    new_business_arr: 229581, new_business_count: 19,
    expansion_arr: 0, expansion_count: 0,
    crosssell_arr: 0, crosssell_count: 0,
    renewal_arr: 0, renewal_count: 0,
    unassigned_arr: 4680, unassigned_count: 1,
    total_closed_arr: 234261, total_closed_count: 20,
  },
];

// HubSpot Renewal Pipeline data by quarter — pulled via MCP on 2026-07-23
// Source: Renewal Pipeline (29808529), "Churned" and "Renewed" stages
//
// Key fields:
//   expiring_arr = "Renewable ARR" — original contract value (what was at risk)
//   hs_arr       = "Annual recurring revenue" — current deal ARR
//
// The Proforma uses: churned_arr = expiring_arr − renewal_arr (exact).
// For 2024, PF churn ≈ churned deals' expiring_arr (seeded from HS).
// For 2025+, PF churn is model-projected (waterfall), not a direct HS pull.
export const HUBSPOT_RENEWAL_DATA = [
  {
    quarter: "2024-Q1",
    renewed_expiring_arr: 1505798, renewed_arr: 1556875, renewed_count: 157,
    churned_expiring_arr: 467964, churned_arr: 286451, churned_count: 49,
  },
  {
    quarter: "2024-Q2",
    renewed_expiring_arr: 1391843, renewed_arr: 1356571, renewed_count: 125,
    churned_expiring_arr: 248636, churned_arr: 173099, churned_count: 24,
  },
  {
    quarter: "2024-Q3",
    renewed_expiring_arr: 1112160, renewed_arr: 1101824, renewed_count: 100,
    churned_expiring_arr: 384206, churned_arr: 306410, churned_count: 36,
  },
  {
    quarter: "2024-Q4",
    renewed_expiring_arr: 1713128, renewed_arr: 1742457, renewed_count: 133,
    churned_expiring_arr: 537125, churned_arr: 388537, churned_count: 45,
  },
  {
    quarter: "2025-Q1",
    renewed_expiring_arr: 1607245, renewed_arr: 1576983, renewed_count: 151,
    churned_expiring_arr: 319573, churned_arr: 312915, churned_count: 29,
  },
  {
    quarter: "2025-Q2",
    renewed_expiring_arr: 1371703, renewed_arr: 1350332, renewed_count: 120,
    churned_expiring_arr: 271773, churned_arr: 289806, churned_count: 24,
  },
  {
    quarter: "2025-Q3",
    renewed_expiring_arr: 1247816, renewed_arr: 1273874, renewed_count: 105,
    churned_expiring_arr: 251541, churned_arr: 269803, churned_count: 30,
  },
  {
    quarter: "2025-Q4",
    renewed_expiring_arr: 1667176, renewed_arr: 1735702, renewed_count: 121,
    churned_expiring_arr: 409584, churned_arr: 427760, churned_count: 38,
  },
  {
    quarter: "2026-Q1",
    renewed_expiring_arr: 1482343, renewed_arr: 1638245, renewed_count: 140,
    churned_expiring_arr: 308248, churned_arr: 326076, churned_count: 26,
  },
  {
    quarter: "2026-Q2",
    renewed_expiring_arr: 1305699, renewed_arr: 1392412, renewed_count: 111,
    churned_expiring_arr: 255310, churned_arr: 274369, churned_count: 29,
  },
];

export type HubSpotDeal = (typeof HUBSPOT_DEAL_DATA)[number];
export type HubSpotRenewal = (typeof HUBSPOT_RENEWAL_DATA)[number];
