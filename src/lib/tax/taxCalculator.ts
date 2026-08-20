import {
  FEDERAL_BRACKETS, ONTARIO_BRACKETS,
  FEDERAL_BASIC_PERSONAL, ONTARIO_BASIC_PERSONAL,
  COMBINED_CORP_RATE,
  NON_ELIGIBLE_GROSS_UP, NON_ELIGIBLE_FED_CREDIT_RATE, NON_ELIGIBLE_ON_CREDIT_RATE,
  CPP_MAX_PENSIONABLE, CPP_BASIC_EXEMPTION, CPP_EMPLOYEE_RATE, CPP_MAX_EMPLOYEE_CONTRIBUTION,
} from "./canadianTaxRates";

function calcBracketTax(income: number, brackets: typeof FEDERAL_BRACKETS, basicPersonal: number): number {
  const taxable = Math.max(0, income - basicPersonal);
  let tax = 0;
  let remaining = taxable;
  for (const b of brackets) {
    const bracketWidth = b.max === Infinity ? remaining : Math.max(0, b.max - b.min);
    const inBracket = Math.min(remaining, bracketWidth);
    tax += inBracket * b.rate;
    remaining -= inBracket;
    if (remaining <= 0) break;
  }
  return Math.max(0, tax);
}

function personalTax(income: number): number {
  return calcBracketTax(income, FEDERAL_BRACKETS, FEDERAL_BASIC_PERSONAL)
       + calcBracketTax(income, ONTARIO_BRACKETS, ONTARIO_BASIC_PERSONAL);
}

function dividendPersonalTax(dividendAmount: number, otherIncome: number): number {
  const grossedUp = dividendAmount * (1 + NON_ELIGIBLE_GROSS_UP);
  const totalIncome = otherIncome + grossedUp;
  const totalTax = personalTax(totalIncome);
  const baseTax = personalTax(otherIncome);
  const marginalTax = totalTax - baseTax;
  const fedCredit = grossedUp * NON_ELIGIBLE_FED_CREDIT_RATE;
  const onCredit = grossedUp * NON_ELIGIBLE_ON_CREDIT_RATE;
  return Math.max(0, marginalTax - fedCredit - onCredit);
}

function cppContribution(salary: number): number {
  const pensionable = Math.min(salary, CPP_MAX_PENSIONABLE) - CPP_BASIC_EXEMPTION;
  if (pensionable <= 0) return 0;
  return Math.min(pensionable * CPP_EMPLOYEE_RATE, CPP_MAX_EMPLOYEE_CONTRIBUTION);
}

export interface TaxScenario {
  label: string;
  salary: number;
  dividend: number;
  corpTax: number;
  personalTax: number;
  cppEmployee: number;
  cppEmployer: number;
  totalTax: number;
  afterTax: number;
}

export function calculateScenarios(
  corpNetIncome: number,
  personalOtherIncome: number,
  _wantRRSP: boolean,
  _rrspAmount: number,
): TaxScenario[] {
  const corpTax = corpNetIncome * COMBINED_CORP_RATE;
  const afterCorpTax = corpNetIncome - corpTax;

  // Scenario 1: All salary
  const salary1 = afterCorpTax;
  const cpp1e = cppContribution(salary1);
  const cpp1r = cpp1e; // employer matches
  const salaryDeductible = salary1 + cpp1r; // corp deducts salary + employer CPP
  // Re-calc: if salary is paid, corp income reduces
  const corpIncome1 = Math.max(0, corpNetIncome - salaryDeductible);
  const corpTax1 = corpIncome1 * COMBINED_CORP_RATE;
  const personalTax1 = personalTax(salary1 + personalOtherIncome);
  const total1 = corpTax1 + personalTax1 + cpp1e + cpp1r;

  // Scenario 2: All dividends
  const corpTax2 = corpTax;
  const div2 = afterCorpTax;
  const personalTax2 = dividendPersonalTax(div2, personalOtherIncome);
  const total2 = corpTax2 + personalTax2;

  // Scenario 3: Blended — salary up to basic personal, rest as dividends
  const optSalary = FEDERAL_BASIC_PERSONAL;
  const cpp3e = cppContribution(optSalary);
  const cpp3r = cpp3e;
  const corpIncome3 = Math.max(0, corpNetIncome - optSalary - cpp3r);
  const corpTax3 = corpIncome3 * COMBINED_CORP_RATE;
  const remainingAfterCorpTax3 = corpIncome3 - corpTax3;
  const div3 = Math.max(0, remainingAfterCorpTax3);
  const personalTax3 = personalTax(optSalary + personalOtherIncome) 
    + (div3 > 0 ? dividendPersonalTax(div3, optSalary + personalOtherIncome) : 0);
  const total3 = corpTax3 + personalTax3 + cpp3e + cpp3r;

  return [
    {
      label: "All Salary",
      salary: salary1, dividend: 0,
      corpTax: corpTax1, personalTax: personalTax1,
      cppEmployee: cpp1e, cppEmployer: cpp1r,
      totalTax: total1, afterTax: corpNetIncome - total1,
    },
    {
      label: "All Dividends",
      salary: 0, dividend: div2,
      corpTax: corpTax2, personalTax: personalTax2,
      cppEmployee: 0, cppEmployer: 0,
      totalTax: total2, afterTax: corpNetIncome - total2,
    },
    {
      label: "Blended (Optimal)",
      salary: optSalary, dividend: div3,
      corpTax: corpTax3, personalTax: personalTax3,
      cppEmployee: cpp3e, cppEmployer: cpp3r,
      totalTax: total3, afterTax: corpNetIncome - total3,
    },
  ];
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}
