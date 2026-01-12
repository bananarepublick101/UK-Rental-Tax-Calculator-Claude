import { Transaction, Property, HMRCCategory, CategoryLabels, TaxYear, getTaxYearDates } from '../types';

const XeroAccountCodes: Record<HMRCCategory, string> = {
  [HMRCCategory.RENTAL_INC_001]: '200', 
  [HMRCCategory.REPAIRS_101]: '320',    
  [HMRCCategory.MGMT_201]: '400',       
  [HMRCCategory.INSUR_301]: '433',      
  [HMRCCategory.UTIL_401]: '445',       
  [HMRCCategory.COUNCIL_501]: '460',    
  [HMRCCategory.ADVERT_501]: '401',     
  [HMRCCategory.PROF_601]: '404',       
  [HMRCCategory.MORT_INT_701]: '440',   
  [HMRCCategory.TRAVEL_801]: '465',     
  [HMRCCategory.MISC_901]: '429',       
  [HMRCCategory.PERSONAL_000]: '000',   // Personal - not deductible
  [HMRCCategory.UNCATEGORIZED]: '429',  
};

const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportXeroJournals = (transactions: Transaction[], properties: Property[], taxYear: TaxYear) => {
  const { label } = getTaxYearDates(taxYear);
  const yearLabel = label.replace('/', '-');
  
  // Filter out personal expenses from Xero export
  const deductibleTransactions = transactions.filter(t => t.category !== HMRCCategory.PERSONAL_000);
  
  const headers = [
    'Date',
    'Narration',
    'AccountCode',
    'AccountName',
    'TrackingName1',
    'TrackingOption1',
    'Reference', 
    'Debit',
    'Credit'
  ];

  const groupedData: Record<string, { amount: number, propertyId: string, category: HMRCCategory }> = {};

  deductibleTransactions.forEach(t => {
    const key = `${t.propertyId}-${t.category}`;
    if (!groupedData[key]) {
      groupedData[key] = { amount: 0, propertyId: t.propertyId, category: t.category };
    }
    groupedData[key].amount += t.amount;
  });

  const rows = Object.values(groupedData).map(group => {
    const journalDate = new Date().toISOString().split('T')[0].split('-').reverse().join('/'); 
    const propertyName = properties.find(p => p.id === group.propertyId)?.name || 'Unknown Property';
    const accountCode = XeroAccountCodes[group.category];
    const accountName = CategoryLabels[group.category];
    const description = `Aggregated ${accountName} - ${yearLabel}`;
    const reference = group.category;

    const isExpense = group.amount < 0;
    const absAmount = Math.abs(group.amount).toFixed(2);
    
    const debit = isExpense ? absAmount : '';
    const credit = !isExpense ? absAmount : '';

    return [
      journalDate,
      description,
      accountCode,
      accountName,
      'Property',
      propertyName,
      reference,
      debit,
      credit
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadCSV(csvContent, `Xero_Journals_${yearLabel}.csv`);
};

export const exportMTDBridging = (transactions: Transaction[], properties: Property[], taxYear: TaxYear) => {
  const { start, end, label } = getTaxYearDates(taxYear);
  const yearLabel = label.replace('/', '-');

  // Filter out personal expenses from MTD export
  const deductibleTransactions = transactions.filter(t => t.category !== HMRCCategory.PERSONAL_000);

  const headers = [
    'Category Code',
    'Category Name',
    'Tax Year Start',
    'Tax Year End',
    'Total Amount',
    'Transaction Count'
  ];

  const groupedData: Record<HMRCCategory, { amount: number, count: number }> = {} as any;

  Object.values(HMRCCategory).forEach(cat => {
    groupedData[cat] = { amount: 0, count: 0 };
  });

  deductibleTransactions.forEach(t => {
    if (groupedData[t.category]) {
      groupedData[t.category].amount += t.amount;
      groupedData[t.category].count += 1;
    }
  });

  const rows = Object.entries(groupedData)
    .filter(([cat, data]) => data.count > 0 && cat !== HMRCCategory.PERSONAL_000)
    .map(([cat, data]) => {
      return [
        cat,
        CategoryLabels[cat as HMRCCategory],
        start,
        end,
        data.amount.toFixed(2),
        data.count
      ].join(',');
    });

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadCSV(csvContent, `MTD_Bridging_Summary_${yearLabel}.csv`);
};

export const exportGeneric = (transactions: Transaction[], properties: Property[], taxYear: TaxYear) => {
  const { label } = getTaxYearDates(taxYear);
  const headers = ['Date', 'Description', 'Amount', 'Category', 'Property', 'HMRC Code', 'Owner Tag', 'Invoice Matched'];
  
  const rows = transactions.map(t => [
    t.date,
    `"${t.description.replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    `"${CategoryLabels[t.category]}"`,
    `"${properties.find(p => p.id === t.propertyId)?.name || 'Unknown'}"`,
    t.category,
    t.tag || 'Unassigned',
    t.matchedInvoiceId ? 'Yes' : 'No'
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadCSV(csvContent, `Tax_Transactions_${label.replace('/','-')}.csv`);
};
