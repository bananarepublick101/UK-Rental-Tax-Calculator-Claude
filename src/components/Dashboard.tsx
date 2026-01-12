
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Transaction, HMRCCategory, TaxYear, isDateInTaxYear, getTaxYearDates, Property } from '../types';
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertCircle, Plus, Building2, X, Trash2, Home, Wallet, PieChart, Users } from 'lucide-react';

const StatCard = ({ title, value, icon, trend, trendColor, delay }: { title: string, value: number, icon: React.ReactNode, trend: string, trendColor: string, delay: number }) => (
    <div 
        className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden animate-fade-in-up"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-zinc-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-zinc-900 tracking-tight">
                    £{value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                </h3>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 group-hover:bg-white group-hover:shadow-md transition-all duration-300">
                {icon}
            </div>
        </div>
        <div className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${trendColor} transition-colors`}>
            {trend === 'Income' && <ArrowUpRight className="w-3 h-3" />}
            {trend === 'Expenses' && <ArrowDownRight className="w-3 h-3" />}
            {trend === 'Net Profit' && <TrendingUp className="w-3 h-3" />}
            {trend}
        </div>
    </div>
);

interface DashboardProps {
  transactions: Transaction[];
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  taxYear: TaxYear;
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions, properties, setProperties, taxYear }) => {
  const taxYearInfo = getTaxYearDates(taxYear);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropAddress, setNewPropAddress] = useState('');
  const [newPropKeywords, setNewPropKeywords] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => isDateInTaxYear(t.date, taxYear));
  }, [transactions, taxYear]);

  // Helper to check if expense is deductible (not personal)
  const isDeductibleExpense = (t: Transaction) => 
    t.amount < 0 && t.category !== HMRCCategory.PERSONAL_000;

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    // Exclude PERSONAL_000 from deductible expenses
    const expenses = filteredTransactions
      .filter(isDeductibleExpense)
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const profit = income - expenses;
    const uncategorizedCount = filteredTransactions.filter(t => t.category === HMRCCategory.UNCATEGORIZED).length;
    
    return { income, expenses, profit, uncategorizedCount };
  }, [filteredTransactions]);

  const ownershipSplit = useMemo(() => {
    const dIncome = filteredTransactions.filter(t => t.tag === 'D' && t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    // Exclude PERSONAL_000 from expense split calculations
    const dExpense = filteredTransactions
      .filter(t => t.tag === 'D' && isDeductibleExpense(t))
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const jIncome = filteredTransactions.filter(t => t.tag === 'J' && t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const jExpense = filteredTransactions
      .filter(t => t.tag === 'J' && isDeductibleExpense(t))
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    
    const totalRecordedIncome = dIncome + jIncome || 1;
    const totalRecordedExpense = dExpense + jExpense || 1;

    return {
        dIncome, dExpense, jIncome, jExpense,
        dIncomePct: (dIncome / totalRecordedIncome) * 100,
        jIncomePct: (jIncome / totalRecordedIncome) * 100,
        dExpensePct: (dExpense / totalRecordedExpense) * 100,
        jExpensePct: (jExpense / totalRecordedExpense) * 100,
    };
  }, [filteredTransactions]);

  const propertyStats = useMemo(() => {
      return properties.map(prop => {
          const propTrans = filteredTransactions.filter(t => t.propertyId === prop.id);
          const income = propTrans.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
          // Exclude PERSONAL_000 from property expense calculations
          const expenses = propTrans
            .filter(isDeductibleExpense)
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
          const profit = income - expenses;
          return { ...prop, income, expenses, profit };
      });
  }, [properties, filteredTransactions]);

  const chartData = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const data = months.map(m => ({ name: m, income: 0, expense: 0 }));
    
    filteredTransactions.forEach(t => {
        const date = new Date(t.date);
        const monthIndex = date.getMonth(); 
        const taxYearIndex = (monthIndex - 3 + 12) % 12;
        
        if (taxYearIndex >= 0 && taxYearIndex < 12) {
            if (t.amount > 0) data[taxYearIndex].income += t.amount;
            // Exclude PERSONAL_000 from chart expense data
            else if (t.category !== HMRCCategory.PERSONAL_000) {
                data[taxYearIndex].expense += Math.abs(t.amount);
            }
        }
    });
    return data;
  }, [filteredTransactions]);

  const handleAddProperty = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPropName || !newPropAddress) return;
      
      const newProp: Property = {
          id: Math.random().toString(36).substr(2, 9),
          name: newPropName,
          address: newPropAddress,
          keywords: newPropKeywords
      };
      
      setProperties(prev => [...prev, newProp]);
      setNewPropName('');
      setNewPropAddress('');
      setNewPropKeywords('');
      setShowAddProperty(false);
  };

  const handleDeleteProperty = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to remove this property?')) {
          setProperties(prev => prev.filter(p => p.id !== id));
      }
  };

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Income" value={stats.income} icon={<ArrowUpRight className="w-5 h-5 text-emerald-500" />} trend="Income" trendColor="bg-emerald-100 text-emerald-700" delay={0} />
        <StatCard title="Deductible Expenses" value={stats.expenses} icon={<ArrowDownRight className="w-5 h-5 text-rose-500" />} trend="Expenses" trendColor="bg-rose-100 text-rose-700" delay={50} />
        <StatCard title="Net Profit" value={stats.profit} icon={<TrendingUp className="w-5 h-5 text-indigo-500" />} trend="Net Profit" trendColor="bg-indigo-100 text-indigo-700" delay={100} />
        <div 
            className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: '150ms' }}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-zinc-500 mb-1">Uncategorized</p>
                    <h3 className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.uncategorizedCount}</h3>
                </div>
                <div className={`p-3 rounded-xl border ${stats.uncategorizedCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                    <AlertCircle className="w-5 h-5" />
                </div>
            </div>
            <div className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${stats.uncategorizedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {stats.uncategorizedCount > 0 ? 'Needs Review' : 'All Clear'}
            </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 mb-6">Monthly Cash Flow ({taxYearInfo.label})</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                        formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', padding: '12px 16px' }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '8px', fontWeight: 'bold' }}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" name="Deductible Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Partner Split Panel */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">Partner Split</h3>
              </div>
              
              <div className="space-y-8 flex-1">
                  <div>
                      <div className="flex justify-between text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2">
                          <span>Income Share</span>
                          <span>£{(ownershipSplit.dIncome + ownershipSplit.jIncome).toLocaleString()}</span>
                      </div>
                      <div className="flex w-full h-8 rounded-xl overflow-hidden shadow-inner bg-zinc-100">
                          <div style={{ width: `${ownershipSplit.dIncomePct}%` }} className="bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-1000">D</div>
                          <div style={{ width: `${ownershipSplit.jIncomePct}%` }} className="bg-violet-500 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-1000 border-l border-white/20">J</div>
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] font-bold">
                          <span className="text-indigo-600">D: £{ownershipSplit.dIncome.toLocaleString()}</span>
                          <span className="text-violet-600">J: £{ownershipSplit.jIncome.toLocaleString()}</span>
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2">
                          <span>Expense Share</span>
                          <span>£{(ownershipSplit.dExpense + ownershipSplit.jExpense).toLocaleString()}</span>
                      </div>
                      <div className="flex w-full h-8 rounded-xl overflow-hidden shadow-inner bg-zinc-100">
                          <div style={{ width: `${ownershipSplit.dExpensePct}%` }} className="bg-indigo-400 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-1000">D</div>
                          <div style={{ width: `${ownershipSplit.jExpensePct}%` }} className="bg-violet-400 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-1000 border-l border-white/20">J</div>
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] font-bold">
                          <span className="text-indigo-500">D: £{ownershipSplit.dExpense.toLocaleString()}</span>
                          <span className="text-violet-500">J: £{ownershipSplit.jExpense.toLocaleString()}</span>
                      </div>
                  </div>
              </div>

              <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                      Ownership split is based on transaction <span className="text-indigo-600 font-bold">tags (D & J)</span>. Ensure all items are tagged for accurate balancing.
                  </p>
              </div>
          </div>
      </div>

      <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-zinc-900">Property Portfolio</h2>
              <button 
                onClick={() => setShowAddProperty(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-zinc-900/10 hover:shadow-zinc-900/20 hover:-translate-y-0.5"
              >
                  <Plus className="w-4 h-4" /> Add Property
              </button>
          </div>
          
          {properties.length === 0 ? (
              <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-12 text-center group cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-colors" onClick={() => setShowAddProperty(true)}>
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                     <Building2 className="w-8 h-8 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">No properties added</h3>
                  <p className="text-zinc-500 text-sm mb-4 max-w-sm mx-auto">Add your first rental property to start tracking performance per unit.</p>
                  <button className="text-indigo-600 font-semibold text-sm hover:underline">Add a property now</button>
              </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {propertyStats.map((prop, idx) => (
                    <div key={prop.id} className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => handleDeleteProperty(e, prop.id)} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${idx % 2 === 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-zinc-900 line-clamp-1">{prop.name}</h4>
                                    <p className="text-xs text-zinc-500 truncate max-w-[180px]">{prop.address}</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-t border-zinc-50 pt-4">
                            <div><p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">Income</p><p className="font-semibold text-emerald-600 text-sm">£{prop.income.toLocaleString()}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">Expenses</p><p className="font-semibold text-rose-600 text-sm">£{prop.expenses.toLocaleString()}</p></div>
                            <div className="text-right"><p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">Profit</p><p className="font-bold text-zinc-800 text-sm">£{prop.profit.toLocaleString()}</p></div>
                        </div>
                    </div>
                ))}
            </div>
          )}
      </div>

      {showAddProperty && (
          <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-zinc-200">
                  <div className="flex justify-between items-center p-5 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-lg font-bold text-zinc-900">Add New Property</h3>
                      <button onClick={() => setShowAddProperty(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors bg-white p-1 rounded-full hover:shadow-sm border border-transparent hover:border-zinc-200"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleAddProperty} className="p-6 space-y-5">
                      <div><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Property Name / Alias</label><input type="text" required placeholder="e.g. The Penthouse" className="w-full px-4 py-3 bg-zinc-50 text-zinc-900 placeholder-zinc-400 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" value={newPropName} onChange={(e) => setNewPropName(e.target.value)} /></div>
                      <div><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Full Address</label><input type="text" required placeholder="e.g. 12 Baker Street, London" className="w-full px-4 py-3 bg-zinc-50 text-zinc-900 placeholder-zinc-400 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" value={newPropAddress} onChange={(e) => setNewPropAddress(e.target.value)} /></div>
                      <div><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Auto-assign Keywords</label><input type="text" placeholder="e.g. TenantName, Postcode" className="w-full px-4 py-3 bg-zinc-50 text-zinc-900 placeholder-zinc-400 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" value={newPropKeywords} onChange={(e) => setNewPropKeywords(e.target.value)} /><p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">Transactions containing these words will be automatically linked to this property.</p></div>
                      <div className="pt-2 flex justify-end gap-3"><button type="button" onClick={() => setShowAddProperty(false)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button><button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40">Save Property</button></div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
