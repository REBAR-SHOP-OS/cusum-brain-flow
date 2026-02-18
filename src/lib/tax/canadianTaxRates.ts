// Canadian Tax Rates — Ontario 2024/2025

export const FEDERAL_BRACKETS = [
  { min: 0, max: 55867, rate: 0.15 },
  { min: 55867, max: 111733, rate: 0.205 },
  { min: 111733, max: 154906, rate: 0.26 },
  { min: 154906, max: 220000, rate: 0.29 },
  { min: 220000, max: Infinity, rate: 0.33 },
];

export const ONTARIO_BRACKETS = [
  { min: 0, max: 51446, rate: 0.0505 },
  { min: 51446, max: 102894, rate: 0.0915 },
  { min: 102894, max: 150000, rate: 0.1116 },
  { min: 150000, max: 220000, rate: 0.1216 },
  { min: 220000, max: Infinity, rate: 0.1316 },
];

export const FEDERAL_BASIC_PERSONAL = 15705;
export const ONTARIO_BASIC_PERSONAL = 11865;

// Corporate rates (SBD first $500K)
export const FEDERAL_SBD_RATE = 0.09;
export const ONTARIO_SBD_RATE = 0.032;
export const COMBINED_CORP_RATE = FEDERAL_SBD_RATE + ONTARIO_SBD_RATE; // ~12.2%

// Eligible dividends (from large corps or LRIP)
export const ELIGIBLE_GROSS_UP = 0.38;
export const ELIGIBLE_FED_CREDIT_RATE = 0.150198;
export const ELIGIBLE_ON_CREDIT_RATE = 0.10;

// Non-eligible dividends (from SBD income)
export const NON_ELIGIBLE_GROSS_UP = 0.15;
export const NON_ELIGIBLE_FED_CREDIT_RATE = 0.090301;
export const NON_ELIGIBLE_ON_CREDIT_RATE = 0.029863;

// CPP
export const CPP_MAX_PENSIONABLE = 68500;
export const CPP_BASIC_EXEMPTION = 3500;
export const CPP_EMPLOYEE_RATE = 0.0595;
export const CPP_MAX_EMPLOYEE_CONTRIBUTION = 3867;

// Common CCA classes
export const CCA_CLASSES = [
  { classNum: 8, rate: 20, description: "Furniture, equipment, machinery" },
  { classNum: 10, rate: 30, description: "Motor vehicles, computers (pre-2022)" },
  { classNum: 10.1, rate: 30, description: "Passenger vehicles > $36,000" },
  { classNum: 12, rate: 100, description: "Tools, utensils, moulds < $500" },
  { classNum: 46, rate: 30, description: "Data network equipment" },
  { classNum: 50, rate: 55, description: "Computers & peripherals (post-2022)" },
  { classNum: 52, rate: 100, description: "Zero-emission vehicles" },
];

// Deduction categories
export const DEDUCTION_CATEGORIES = [
  { key: "home-office", label: "Home Office", description: "Rent/mortgage interest, utilities, property tax %" },
  { key: "phone", label: "Phone & Internet", description: "Business portion of phone & internet" },
  { key: "software", label: "Software / SaaS", description: "100% deductible subscriptions" },
  { key: "professional", label: "Professional Fees", description: "Accounting, legal, consulting" },
  { key: "banking", label: "Banking & FX Fees", description: "Bank, Stripe, Shopify, FX fees" },
  { key: "insurance", label: "Business Insurance", description: "All business insurance premiums" },
  { key: "education", label: "Education", description: "Courses directly related to business" },
  { key: "other", label: "Other", description: "Other CRA-eligible deductions" },
] as const;
