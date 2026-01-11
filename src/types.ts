export enum HMRCCategory {
  RENTAL_INC_001 = 'RENTAL_INC_001',
  REPAIRS_101 = 'REPAIRS_101',
  MGMT_201 = 'MGMT_201',
  INSUR_301 = 'INSUR_301',
  UTIL_401 = 'UTIL_401',
  COUNCIL_501 = 'COUNCIL_501',
  ADVERT_501 = 'ADVERT_501',
  PROF_601 = 'PROF_601',
  MORT_INT_701 = 'MORT_INT_701',
  TRAVEL_801 = 'TRAVEL_801',
  MISC_901 = 'MISC_901',
  UNCATEGORIZED = 'UNCATEGORIZED'
}

export const CategoryLabels: Record<HMRCCategory, string> = {
  [HMRCCategory.RENTAL_INC_001]: 'Rental Income',
  [HMRCCategory.REPAIRS_101]: 'Repairs & Maintenance',
  [HMRCCategory.MGMT_201]: 'Management Fees',
  [HMRCCategory.INSUR_301]: 'Insurance',
  [HMRCCategory.UTIL_401]: 'Utilities',
  [HMRCCategory.COUNCIL_501]: 'Council Tax',
  [HMRCCategory.ADVERT_501]: 'Advertising & Lettings',
  [HMRCCategory.PROF_601]: 'Professional Fees',
  [HMRCCategory.MORT_INT_701]: 'Mortgage Interest (Sec 24)',
  [HMRCCategory.TRAVEL_801]: 'Travel & Vehicle',
  [HMRCCategory.MISC_901]: 'Misc / Office',
  [HMRCCategory.UNCATEGORIZED]: 'Uncategorized',
};

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  propertyId: string;
  category: HMRCCategory;
  status: 'reconciled' | 'pending' | 'flagged';
  source: 'bank_upload' | 'manual';
  matchedInvoiceId?: string;
  tag?: 'D' | 'J';
}

export interface Invoice {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  description: string;
  status: 'matched' | 'unmatched' | 'processing';
  base64Image?: string;
  matchedTransactionId?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  keywords?: string;
}

export interface TaxEstimate {
  totalIncome: number;
  totalExpenses: number;
  financeCosts: number;
  netCashFlow: number;
  taxableProfit: number;
  estimatedTaxBeforeRelief: number;
  financeCostRelief: number;
  finalEstimatedTax: number;
  effectiveRate: number;
  breakdown: {
    personalAllowance: number;
    basicRateTax: number;
    higherRateTax: number;
    additionalTax: number;
  }
}

export type TaxYear = '2023-2024' | '2024-2025' | '2025-2026' | '2026-2027';
export const TAX_YEARS: TaxYear[] = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];

export const getTaxYearDates = (year: TaxYear) => {
  const startYear = parseInt(year.split('-')[0]);
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
    label: `${startYear}/${(startYear + 1).toString().slice(2)}`
  };
};

export const isDateInTaxYear = (dateStr: string, year: TaxYear): boolean => {
  const { start, end } = getTaxYearDates(year);
  return dateStr >= start && dateStr <= end;
};
