export const WITHHOLDING_TAX_RATE = 0.033;
export const HEALTH_INSURANCE_MONTHLY_THRESHOLD = 240245;

export interface NetIncomeResult {
  contractAmount: number;
  tax: number;
  netIncome: number;
}

export interface ContractAmountResult {
  netIncome: number;
  tax: number;
  contractAmount: number;
}

export interface HealthInsuranceEstimate {
  monthlyIncome: number;
  threshold: number;
  exceedsThreshold: boolean;
}

export function calculateNetIncome(contractAmount: number): NetIncomeResult {
  const tax = Math.round(contractAmount * WITHHOLDING_TAX_RATE);
  return {
    contractAmount,
    tax,
    netIncome: contractAmount - tax,
  };
}

export function calculateContractAmount(netIncome: number): ContractAmountResult {
  const contractAmount = Math.round(netIncome / (1 - WITHHOLDING_TAX_RATE));
  return {
    netIncome,
    tax: contractAmount - netIncome,
    contractAmount,
  };
}

export function estimateHealthInsurance(monthlyIncome: number): HealthInsuranceEstimate {
  return {
    monthlyIncome,
    threshold: HEALTH_INSURANCE_MONTHLY_THRESHOLD,
    exceedsThreshold: monthlyIncome >= HEALTH_INSURANCE_MONTHLY_THRESHOLD,
  };
}
