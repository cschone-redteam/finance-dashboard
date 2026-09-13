export type PLFunction =
  | "CX"
  | "Infrastructure"
  | "G&A"
  | "Sales"
  | "Marketing"
  | "R&D";

export type RevenueProduct =
  | "Flex"
  | "Go"
  | "Fieldlens"
  | "Other"
  | "Discounts";

export const CLASS_TO_FUNCTION: Record<string, PLFunction> = {
  Implementation: "CX",
  Support: "CX",
  Success: "CX",
  Infrastructure: "Infrastructure",
  "Executive Management": "G&A",
  Operations: "G&A",
  Sales: "Sales",
  Marketing: "Marketing",
  "Product Development": "R&D",
  "Product Management": "R&D",
  "Product SME": "R&D",
  "Quality Assurance": "R&D",
};

export const REVENUE_CLASS_MAP: Record<string, RevenueProduct> = {
  "RedTeam Subscription - New": "Flex",
  "RedTeam Subscription - Renewal": "Flex",
  "RedTeam Subscription - Add-On": "Flex",
  "RedTeam License Fees - New": "Flex",
  "Pro Services - New": "Flex",
  "Pro Services - Renewal": "Flex",
  "PASKR > RedTeamGo": "Go",
  "FieldLens - New": "Fieldlens",
  "FieldLens - Renewal": "Fieldlens",
  "TeamPlayer Subscription - New": "Other",
  "Other Revenue": "Other",
  "Discounts - New": "Discounts",
  "Discounts - Renewal": "Discounts",
  Discounts: "Discounts",
};

export const REVENUE_ACCOUNT_FALLBACK: Record<string, RevenueProduct> = {
  RedTeamFlex: "Flex",
  RedTeamGo: "Go",
  Fieldlens: "Fieldlens",
  "Other Sales": "Other",
  Discounts: "Discounts",
};

export function classifyRevenue(
  itemClass: string | null,
  accountName: string | null,
): RevenueProduct {
  if (itemClass && REVENUE_CLASS_MAP[itemClass]) {
    return REVENUE_CLASS_MAP[itemClass];
  }
  if (accountName) {
    for (const [key, product] of Object.entries(REVENUE_ACCOUNT_FALLBACK)) {
      if (accountName.includes(key)) return product;
    }
  }
  return "Other";
}

export function classifyExpense(itemClass: string | null): PLFunction {
  if (itemClass && CLASS_TO_FUNCTION[itemClass]) {
    return CLASS_TO_FUNCTION[itemClass];
  }
  return "R&D";
}

export interface PLByFunctionData {
  revenue: Record<RevenueProduct, number[]>;
  cogs: Record<"CX" | "Infrastructure", number[]>;
  opex: Record<"G&A" | "Sales" | "Marketing" | "R&D", number[]>;
  other: {
    interest: number[];
    amortization: number[];
    depreciation: number[];
    tax: number[];
  };
}

export function emptyPL(): PLByFunctionData {
  const z = () => new Array(12).fill(0);
  return {
    revenue: { Flex: z(), Go: z(), Fieldlens: z(), Other: z(), Discounts: z() },
    cogs: { CX: z(), Infrastructure: z() },
    opex: { "G&A": z(), Sales: z(), Marketing: z(), "R&D": z() },
    other: { interest: z(), amortization: z(), depreciation: z(), tax: z() },
  };
}
