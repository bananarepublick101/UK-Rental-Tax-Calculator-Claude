import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Transaction, TaxYear, isDateInTaxYear, getTaxYearDates, HMRCCategory } from '../types';
import { parseInvoiceImage } from '../services/geminiService';
import { UploadCloud, FileText, Loader2, Check, AlertCircle, Link as LinkIcon, CheckCircle2, X, Trash2 } from 'lucide-react';

interface InvoiceManagerProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  taxYear: TaxYear;
}

// Simple Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'warning', onClose: () => void }) => (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in-up z-50 border
        ${type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : 'bg-white border-amber-100 text-amber-800'}
    `}>
        <div className={`p-1 rounded-full ${type === 'success' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
        </div>
        <span className="font-medium text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 hover:bg-zinc-100 p-1 rounded"><X size={14} /></button>
    </div>
);

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ 
    invoices, 
    setInvoices, 
    transactions, 
    setTransactions, 
    taxYear 
}) => {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'warning'} | null>(null);

  const taxYearInfo = getTaxYearDates(taxYear);

  // Auto-hide toast
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Filter transactions: Only Expenses, in current Tax Year, EXCLUDE Personal and Uncategorized
  const expenseTransactions = useMemo(() => {
    return transactions
        .filter(t => 
            isDateInTaxYear(t.date, taxYear) && 
            t.amount < 0 &&
            t.category !== HMRCCategory.PERSONAL_000 &&
            t.category !== HMRCCategory.UNCATEGORIZED
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, taxYear]);

  // Calculate stats
  // A transaction is "done" if it has a matched file OR is manually reconciled
  const matchedExpenses = expenseTransactions.filter(t => t.matchedInvoiceId || t.status === 'reconciled').length;
  const totalExpenses = expenseTransactions.length;
  const progressPercentage = totalExpenses > 0 ? (matchedExpenses / totalExpenses) * 100 : 0;

  const processFile = async (file: File) => {
      setLoading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
          try {
              const base64 = reader.result as string;
              // Call Gemini with correct MIME type
              const mimeType = file.type || 'image/jpeg';
              const extractedData = await parseInvoiceImage(base64, mimeType);
              
              const newInvoice: Invoice = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: extractedData.date || new Date().toISOString().split('T')[0],
                  vendor: extractedData.vendor || 'Unknown Vendor',
                  amount: extractedData.amount || 0,
                  description: extractedData.description || 'Uploaded Invoice',
                  status: 'unmatched', // Default to unmatched
                  base64Image: base64
              };

              // --- SMART MATCHING LOGIC ---
              const match = expenseTransactions.find(t => {
                  if (t.matchedInvoiceId) return false;
                  const amountMatch = Math.abs(Math.abs(t.amount) - newInvoice.amount) < 0.10;
                  const tDate = new Date(t.date).getTime();
                  const iDate = new Date(newInvoice.date).getTime();
                  const diffTime = Math.abs(tDate - iDate);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                  return amountMatch && diffDays <= 7;
              });

              if (match) {
                  newInvoice.status = 'matched';
                  newInvoice.matchedTransactionId = match.id;
                  setTransactions(prev => prev.map(t => 
                      t.id === match.id ? { ...t, matchedInvoiceId: newInvoice.id, status: 'reconciled' } : t
                  ));
                  setToast({ message: `Success! Matched with "${match.description}"`, type: 'success' });
              } else {
                  setToast({ message: "Invoice uploaded but no matching bank transaction found.", type: 'warning' });
              }

              setInvoices(prev => [...prev, newInvoice]);
          } catch (err) {
              console.error(err);
              setToast({ message: "AI Error - Saved as draft.", type: 'warning' });
               // Fallback creation if AI fails
               const newInvoice: Invoice = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: new Date().toISOString().split('T')[0],
                  vendor: 'Unknown (AI Failed)',
                  amount: 0,
                  description: 'Manual Review Required',
                  status: 'unmatched',
                  base64Image: reader.result as string
              };
              setInvoices(prev => [...prev, newInvoice]);
          } finally {
              setLoading(false);
          }
      };
      reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const toggleMatch = (id: string) => {
      setTransactions(prev => prev.map(t => {
          if (t.id !== id) return t;
          const newStatus = t.status === 'reconciled' ? 'pending' : 'reconciled';
          return { ...t, status: newStatus };
      }));
  };

  const deleteInvoice = (id: string) => {
      if (!confirm("Are you sure you want to remove this receipt?")) return;
      const invoiceToDelete = invoices.find(inv => inv.id === id);
      if (invoiceToDelete?.matchedTransactionId) {
          setTransactions(prev => prev.map(t => 
              t.id === invoiceToDelete.matchedTransactionId
                  ? { ...t, matchedInvoiceId: undefined, status: 'pending' }
                  : t
          ));
      }
      setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  return (
    <div className="space-y-6 h-full pb-20 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Receipt Hub</h2>
            <p className="text-sm text-zinc-500">Reconcile expenses for <span className="font-semibold text-indigo-600">{taxYearInfo.label}</span></p>
            <p className="text-xs text-zinc-400 mt-1">Showing deductible expenses only (excludes Personal & Uncategorized)</p>
          </div>
          <div className="text-right">
             <div className="text-3xl font-bold text-zinc-900 tracking-tight">{matchedExpenses} <span className="text-lg text-zinc-400 font-normal">/ {totalExpenses}</span></div>
             <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Expenses Reconciled</div>
          </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)] ${progressPercentage === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
            style={{ width: `${progressPercentage}%` }}
          />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COL: Upload & Recent Uploads */}
          <div className="space-y-6 lg:col-span-1">
             
             {/* Drop Zone */}
             <div 
                className={`h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer relative overflow-hidden group
                    ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 hover:border-indigo-400 bg-white hover:bg-zinc-50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    onChange={handleChange}
                    accept="image/*,application/pdf"
                />
                
                {loading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <span className="text-sm font-medium text-zinc-600">Analyzing Receipt...</span>
                    </div>
                ) : (
                    <>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-zinc-700">Click or Drag Receipt</p>
                        <p className="text-xs text-zinc-400 mt-1">PDF, JPG, PNG supported</p>
                    </>
                )}
            </div>

            {/* Recent Uploads List */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Recent Uploads</h4>
                {invoices.length === 0 && <p className="text-sm text-zinc-400 italic pl-1">No invoices uploaded yet.</p>}
                {invoices.slice().reverse().map(inv => (
                    <div key={inv.id} className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-3 group relative hover:border-indigo-200 transition-colors animate-fade-in-up">
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-100">
                            {inv.base64Image ? (
                                <img src={inv.base64Image} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400"><FileText className="w-5 h-5" /></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-zinc-900 text-sm truncate">{inv.vendor}</div>
                            <div className="text-xs text-zinc-500">£{inv.amount.toFixed(2)}</div>
                        </div>
                        {inv.status === 'matched' ? (
                            <div className="text-emerald-500 bg-emerald-50 p-1.5 rounded-lg" title="Linked to Transaction"><LinkIcon className="w-4 h-4" /></div>
                        ) : (
                            <div className="text-amber-500 bg-amber-50 p-1.5 rounded-lg" title="Unmatched"><AlertCircle className="w-4 h-4" /></div>
                        )}
                        
                        {/* Delete Button */}
                        <button 
                            onClick={() => deleteInvoice(inv.id)}
                            className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Receipt"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
            </div>
          </div>

          {/* RIGHT COL: Expense Checklist */}
          <div className="lg:col-span-2 space-y-4">
             <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <h3 className="font-bold text-zinc-900">Expense Checklist</h3>
                <span className="text-xs text-zinc-400">Tip: Mark personal items as "Personal Expense" in Transactions to hide them here</span>
             </div>

             <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                 {expenseTransactions.length === 0 ? (
                     <div className="p-12 text-center text-zinc-400">
                         <p>No deductible expenses found for this tax year.</p>
                         <p className="text-xs mt-2">Personal and Uncategorized expenses are hidden from this view.</p>
                     </div>
                 ) : (
                     <div className="divide-y divide-zinc-50">
                         {expenseTransactions.map(t => {
                             const hasFile = !!t.matchedInvoiceId;
                             const isReconciled = t.status === 'reconciled' || hasFile;
                             
                             return (
                                 <div 
                                    key={t.id} 
                                    onClick={() => toggleMatch(t.id)}
                                    className={`p-4 flex items-center justify-between transition-colors cursor-pointer group
                                        ${isReconciled ? 'bg-zinc-50/50' : 'hover:bg-zinc-50'}
                                    `}
                                 >
                                     <div className="flex items-center gap-4">
                                         <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300
                                            ${isReconciled 
                                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                                                : 'bg-white border-zinc-300 text-transparent group-hover:border-zinc-400'}
                                         `}>
                                             <Check className="w-3.5 h-3.5" />
                                         </div>
                                         <div>
                                             <div className={`text-sm font-medium transition-colors ${isReconciled ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>
                                                 {t.description}
                                             </div>
                                             <div className="text-xs text-zinc-400">{t.date}</div>
                                         </div>
                                     </div>
                                     
                                     <div className="flex items-center gap-4">
                                         <div className={`font-bold text-sm tabular-nums ${isReconciled ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>
                                             £{Math.abs(t.amount).toFixed(2)}
                                         </div>
                                         <div className="w-24 text-right">
                                             {hasFile ? (
                                                 <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                                                     <LinkIcon className="w-3 h-3" /> Linked
                                                 </span>
                                             ) : isReconciled ? (
                                                 <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-md">
                                                     <CheckCircle2 className="w-3 h-3" /> Manual
                                                 </span>
                                             ) : (
                                                 <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                                                     <AlertCircle className="w-3 h-3" /> Missing
                                                 </span>
                                             )}
                                         </div>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 )}
             </div>
          </div>

      </div>
    </div>
  );
};
