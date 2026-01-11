import React, { useState, useMemo } from 'react';
import { Transaction, TaxYear, isDateInTaxYear, getTaxYearDates, HMRCCategory } from '../types';
import { Calculator, Info, Wallet } from 'lucide-react';

interface TaxEstimatorProps {
  transactions: Transaction[];
  taxYear: TaxYear;
}

export const TaxEstimator: React.FC<TaxEstimatorProps> = ({ transactions, taxYear }) => {
  const [otherIncome, setOtherIncome] = useState<number>(0);

  const taxYearInfo = getTaxYearDates(taxYear);

  const estimate = useMemo(() => {
    // Filter transactions by the selected tax year first
    const yearTransactions = transactions.filter(t => isDateInTaxYear(t.date, taxYear));

    // 1. Calculate Income
    const rentalIncome = yearTransactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);

    // 2. Separate "Finance Costs" (Mortgage Interest) from other Allowable Expenses for Section 24
    const financeCosts = yearTransactions
        .filter(t => t.category === HMRCCategory.MORT_INT_701)
        .reduce((a, b) => a + Math.abs(b.amount), 0);

    const otherExpenses = yearTransactions
        .filter(t => t.amount < 0 && t.category !== HMRCCategory.MORT_INT_701)
        .reduce((a, b) => a + Math.abs(b.amount), 0);
    
    // Taxable Profit does NOT deduct finance costs (since 2020)
    const taxableProfit = Math.max(0, rentalIncome - otherExpenses);
    
    // Net Cash Flow (Real money left) includes paying the mortgage
    const netCashFlow = rentalIncome - otherExpenses - financeCosts;

    // 3. Total Income for Tax Banding
    const totalIncome = taxableProfit + otherIncome;

    // 4. Personal Allowance
    // Reduce allowance by £1 for every £2 over £100k
    let allowance = 12570;
    if (totalIncome > 100000) {
        allowance = Math.max(0, 12570 - (totalIncome - 100000) / 2);
    }
    const taxableIncome = Math.max(0, totalIncome - allowance);

    // 5. Calculate Gross Tax (Before Section 24 Relief)
    // Basic: 20% up to £37,700 (after allowance, i.e. £50,270 total)
    // Higher: 40% from £37,701 to £125,140
    // Additional: 45% above £125,140
    
    let taxBeforeRelief = 0;
    let basicTax = 0;
    let higherTax = 0;
    let additionalTax = 0;

    let remainingTaxable = taxableIncome;

    // Basic Rate Band
    const basicBand = 37700;
    const amountInBasic = Math.min(remainingTaxable, basicBand);
    basicTax = amountInBasic * 0.20;
    remainingTaxable -= amountInBasic;

    // Higher Rate Band
    const higherBand = 125140 - 50270; 
    if (remainingTaxable > 0) {
        const amountInHigher = Math.min(remainingTaxable, higherBand);
        higherTax = amountInHigher * 0.40;
        remainingTaxable -= amountInHigher;
    }

    // Additional Rate Band
    if (remainingTaxable > 0) {
        additionalTax = remainingTaxable * 0.45;
    }

    taxBeforeRelief = basicTax + higherTax + additionalTax;

    // 6. Apply Section 24 Relief (20% of Finance Costs)
    // Relief is capped at the lower of: Finance Costs, Property Profit, or Adjusted Total Income
    const financeCostRelief = Math.min(financeCosts * 0.20, taxBeforeRelief); // Cannot reduce tax below zero

    const finalEstimatedTax = Math.max(0, taxBeforeRelief - financeCostRelief);

    return {
        rentalIncome,
        otherExpenses,
        financeCosts,
        netCashFlow,
        taxableProfit,
        estimatedTaxBeforeRelief: taxBeforeRelief,
        financeCostRelief,
        finalEstimatedTax,
        allowance,
        totalIncome,
        taxableIncome,
        breakdown: { basicTax, higherTax, additionalTax }
    };
  }, [transactions, otherIncome, taxYear]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      
      {/* Header / Main Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-8 rounded-3xl shadow-xl shadow-indigo-900/20 relative overflow-hidden">
          {/* Decorative Circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400 opacity-20 rounded-full blur-2xl -ml-10 -mb-10"></div>
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                            <Calculator className="w-5 h-5 text-indigo-100" />
                        </div>
                        <span className="text-sm font-bold text-indigo-100 uppercase tracking-widest">Estimated Tax Bill</span>
                    </div>
                    <h2 className="text-6xl font-bold mb-2 tracking-tighter">
                        £{estimate.finalEstimatedTax.toLocaleString('en-GB', {maximumFractionDigits: 0})}
                    </h2>
                    <p className="text-indigo-200 text-sm font-medium">
                        Based on data for tax year <span className="text-white font-bold">{taxYearInfo.label}</span>
                    </p>
                  </div>
                  
                  <div className="mt-8">
                      <div className="flex justify-between text-xs font-bold uppercase text-indigo-200 mb-2 tracking-wider">
                          <span>Effective Tax Rate</span>
                          <span>{estimate.rentalIncome > 0 ? ((estimate.finalEstimatedTax / estimate.rentalIncome) * 100).toFixed(1) : 0}% of Gross Rent</span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                          <div 
                            className="bg-white h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                            style={{ width: `${Math.min(100, (estimate.finalEstimatedTax / (estimate.rentalIncome || 1)) * 100)}%` }}
                          ></div>
                      </div>
                  </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-inner">
                  <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Key Figures ({taxYearInfo.label})
                  </h3>
                  <div className="space-y-5">
                      <div>
                          <label className="flex justify-between text-sm font-medium text-indigo-100 mb-1">
                              <span>Taxable Property Profit</span>
                              <span className="text-white font-bold text-lg">£{estimate.taxableProfit.toLocaleString()}</span>
                          </label>
                      </div>
                      <div>
                          <label className="flex justify-between text-sm font-medium text-indigo-100 mb-1">
                              <span>Finance Costs (Sec 24)</span>
                              <span className="text-rose-200 font-bold text-lg">-£{estimate.financeCosts.toLocaleString()}</span>
                          </label>
                      </div>
                      <div className="pt-5 border-t border-white/10">
                          <label className="block text-xs font-bold uppercase text-indigo-200 tracking-wider mb-2">Other Income (Salary, etc)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-900 font-semibold">£</span>
                            <input 
                                type="number" 
                                value={otherIncome} 
                                onChange={(e) => setOtherIncome(Number(e.target.value))}
                                className="w-full bg-white/90 text-indigo-950 font-semibold rounded-xl px-4 py-3 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:bg-white transition-all shadow-lg"
                                placeholder="0.00"
                            />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Breakdown Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
            <h3 className="text-xl font-bold text-zinc-900 mb-6">Calculation Breakdown</h3>
            <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 font-medium">Total Income (Profit + Other)</span>
                    <span className="font-bold text-zinc-900">£{estimate.totalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 font-medium">Personal Allowance</span>
                    <span className="font-bold text-emerald-600">-£{estimate.allowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-500 font-medium">Net Taxable Income</span>
                    <span className="font-bold text-zinc-900">£{estimate.taxableIncome.toLocaleString()}</span>
                </div>
                
                <div className="py-4 space-y-2">
                    <div className="flex justify-between text-zinc-600">
                        <span>Basic Rate Tax (20%)</span>
                        <span className="font-medium">£{estimate.breakdown.basicTax.toLocaleString()}</span>
                    </div>
                    {estimate.breakdown.higherTax > 0 && (
                        <div className="flex justify-between text-zinc-600">
                            <span>Higher Rate Tax (40%)</span>
                            <span className="font-medium">£{estimate.breakdown.higherTax.toLocaleString()}</span>
                        </div>
                    )}
                    {estimate.breakdown.additionalTax > 0 && (
                        <div className="flex justify-between text-zinc-600">
                            <span>Additional Rate Tax (45%)</span>
                            <span className="font-medium">£{estimate.breakdown.additionalTax.toLocaleString()}</span>
                        </div>
                    )}
                </div>
                
                <div className="pt-4 border-t border-zinc-200 bg-zinc-50 -mx-8 px-8 pb-2">
                     <div className="flex justify-between text-zinc-500 mb-2 pt-2 text-xs uppercase font-bold tracking-wider">
                        <span>Gross Tax Liability</span>
                        <span>£{estimate.estimatedTaxBeforeRelief.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Less: Section 24 Relief (20%)</span>
                        <span>-£{estimate.financeCostRelief.toLocaleString()}</span>
                    </div>
                </div>

                <div className="pt-6 flex justify-between items-center border-t border-zinc-200">
                    <span className="font-bold text-lg text-zinc-900">Final Tax Due</span>
                    <span className="font-bold text-2xl text-indigo-600">£{estimate.finalEstimatedTax.toLocaleString()}</span>
                </div>
            </div>
        </div>

        {/* Info / Cash Flow Card */}
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full transition-transform group-hover:scale-110"></div>
                <h3 className="text-xl font-bold text-zinc-900 mb-6 relative z-10">Real Cash Flow</h3>
                <div className="flex items-center gap-6 mb-8 relative z-10">
                    <div className="p-5 bg-emerald-100 text-emerald-600 rounded-2xl shadow-sm">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Cash in Pocket</p>
                        <h4 className="text-4xl font-bold text-zinc-900 tracking-tight">£{estimate.netCashFlow.toLocaleString()}</h4>
                    </div>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed border-l-4 border-emerald-400 pl-4 py-1">
                    This is your actual liquidity after paying all expenses <strong>including</strong> mortgage interest, but <strong>before</strong> tax.
                </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-8">
                <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" /> What is Section 24?
                </h4>
                <p className="text-sm text-indigo-800 leading-relaxed">
                    Often called the "Tenant Tax". Since 2020, landlords cannot deduct mortgage interest from their rental income. Instead, you receive a 20% tax credit. 
                    This can push basic rate taxpayers into the higher rate bracket.
                </p>
            </div>
        </div>

      </div>

      <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest mt-12 mb-4">
          Disclaimer: This tool provides estimates for planning purposes only. Consult a qualified accountant.
      </p>
    </div>
  );
};