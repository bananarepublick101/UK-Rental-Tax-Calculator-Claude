
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, HMRCCategory, CategoryLabels, Property, TaxYear, isDateInTaxYear, getTaxYearDates, Invoice } from '../types';
import { categorizeTransaction, parseBankStatement } from '../services/geminiService';
import { exportXeroJournals, exportMTDBridging, exportGeneric } from '../services/exportService';
import { UploadCloud, CheckCircle, AlertCircle, FileText, Loader2, Filter, Paperclip, ChevronDown, Download, Trash2, Check, X, Search, Tag, UserPlus, AlertTriangle, PlusCircle } from 'lucide-react';

interface TransactionManagerProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  properties: Property[];
  taxYear: TaxYear;
}

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'warning', onClose: () => void }) => (
    <div className={`fixed bottom-24 right-6 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in-up z-50 border
        ${type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : 'bg-white border-amber-100 text-amber-800'}
    `}>
        <div className={`p-1 rounded-full ${type === 'success' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
        </div>
        <span className="font-medium text-sm text-zinc-800">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 hover:bg-zinc-100 p-1 rounded"><X size={14} /></button>
    </div>
);

export const TransactionManager: React.FC<TransactionManagerProps> = ({ 
    transactions, 
    setTransactions, 
    invoices,
    setInvoices,
    properties, 
    taxYear 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'warning'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Custom Modal State
  const [deleteTarget, setDeleteTarget] = useState<'bulk' | string | null>(null);

  // Manual Add Form State
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualDesc, setManualDesc] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPropId, setManualPropId] = useState('');
  const [manualCat, setManualCat] = useState(HMRCCategory.UNCATEGORIZED);
  const [manualTag, setManualTag] = useState<'D' | 'J' | undefined>(undefined);

  const taxYearInfo = getTaxYearDates(taxYear);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  const visibleTransactions = useMemo(() => {
    let filtered = transactions.filter(t => isDateInTaxYear(t.date, taxYear));
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(t => t.description.toLowerCase().includes(lower) || t.amount.toString().includes(lower));
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, taxYear, searchTerm]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const processImportedData = async (dataItems: {date: string, description: string, amount: number}[]) => {
    setIsProcessing(true);
    let addedCount = 0; let skippedCount = 0;
    const existingIds = new Set(transactions.map(t => t.id));

    const promises = dataItems.map(async (item) => {
        const deterministicId = btoa(`${item.date}-${item.description}-${item.amount}`).slice(0, 16);
        if (existingIds.has(deterministicId)) { skippedCount++; return null; }

        const aiResult = await categorizeTransaction(item.description, item.amount, properties);
        const assignedPropertyId = aiResult.propertyId && properties.some(p => p.id === aiResult.propertyId)
            ? aiResult.propertyId : (properties.length > 0 ? properties[0].id : '');

        addedCount++;
        return {
            id: deterministicId, date: item.date, description: item.description, amount: item.amount,
            propertyId: assignedPropertyId, category: aiResult.category, status: 'pending', source: 'bank_upload'
        } as Transaction;
    });

    const results = (await Promise.all(promises)).filter((t): t is Transaction => t !== null);
    if (results.length > 0) setTransactions(prev => [...prev, ...results]);

    setToast({ 
        message: skippedCount > 0 ? `Imported ${addedCount}. Skipped ${skippedCount} duplicates.` : `Analyzed ${addedCount} transactions.`, 
        type: addedCount > 0 ? 'success' : 'warning' 
    });
    setIsProcessing(false);
  };

  const handleManualAdd = (e: React.FormEvent) => {
      e.preventDefault();
      const amount = parseFloat(manualAmount);
      if (isNaN(amount) || !manualDesc) return;

      const deterministicId = btoa(`manual-${manualDate}-${manualDesc}-${amount}-${Date.now()}`).slice(0, 16);
      
      const newTransaction: Transaction = {
          id: deterministicId,
          date: manualDate,
          description: manualDesc,
          amount: amount,
          propertyId: manualPropId,
          category: manualCat,
          tag: manualTag,
          status: 'reconciled',
          source: 'manual'
      };

      setTransactions(prev => [...prev, newTransaction]);
      setToast({ message: 'Transaction added manually', type: 'success' });
      setShowManualAdd(false);
      // Reset form
      setManualDesc(''); setManualAmount(''); setManualTag(undefined);
  };

  const handleFile = async (file: File) => {
    setDragActive(false); setIsProcessing(true);
    try {
        let fileData = ''; const mimeType = file.type || 'application/pdf';
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) fileData = await file.text();
        else fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject; reader.readAsDataURL(file);
        });
        const rawTransactions = await parseBankStatement(fileData, mimeType);
        if (!rawTransactions || rawTransactions.length === 0) {
            alert("No transactions found."); setIsProcessing(false); return;
        }
        await processImportedData(rawTransactions);
    } catch (error) {
        alert("Failed to process bank statement."); setIsProcessing(false);
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === visibleTransactions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleTransactions.map(t => t.id)));
  };

  const bulkApplyTag = (tag: 'D' | 'J' | undefined) => {
    setTransactions(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, tag } : t));
    setSelectedIds(new Set());
    setToast({ message: `Applied tag to ${selectedIds.size} transactions`, type: 'success' });
  };

  const executeDelete = () => {
    if (deleteTarget === 'bulk') {
        const count = selectedIds.size;
        setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
        setToast({ message: `Deleted ${count} transactions`, type: 'success' });
    } else if (typeof deleteTarget === 'string') {
        setTransactions(prev => prev.filter(t => t.id !== deleteTarget));
        const next = new Set(selectedIds); next.delete(deleteTarget as string);
        setSelectedIds(next);
        setToast({ message: 'Transaction deleted', type: 'success' });
    }
    setDeleteTarget(null);
  };

  const updateCategory = (id: string, newCategory: HMRCCategory) => {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, category: newCategory } : t));
  };

  const updateProperty = (id: string, newPropertyId: string) => {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, propertyId: newPropertyId } : t));
  };

  return (
    <div className="space-y-6 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Manual Add Modal */}
      {showManualAdd && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-zinc-100 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-zinc-900">Manual Entry</h3>
                      <button onClick={() => setShowManualAdd(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleManualAdd} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Date</label><input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                          <div><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Amount (£)</label><input type="number" step="0.01" required value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="-45.00" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium tabular-nums" /></div>
                      </div>
                      <div><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Description</label><input type="text" required value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Cash for plumber" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Property</label><select value={manualPropId} onChange={e => setManualPropId(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Partner Tag</label><div className="flex gap-2 h-[38px]"><button type="button" onClick={() => setManualTag(manualTag === 'D' ? undefined : 'D')} className={`flex-1 rounded-xl text-xs font-bold border transition-all ${manualTag === 'D' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>D</button><button type="button" onClick={() => setManualTag(manualTag === 'J' ? undefined : 'J')} className={`flex-1 rounded-xl text-xs font-bold border transition-all ${manualTag === 'J' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>J</button></div></div>
                      </div>
                      <div><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Category</label><select value={manualCat} onChange={e => setManualCat(e.target.value as HMRCCategory)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">{Object.entries(CategoryLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
                      <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all mt-4">Add Transaction</button>
                  </form>
              </div>
          </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 animate-fade-in-up">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4"><AlertTriangle size={32} /></div>
                      <h3 className="text-xl font-bold text-zinc-900">Confirm Deletion</h3>
                      <p className="text-sm text-zinc-500 mt-2">{deleteTarget === 'bulk' ? `Permanently remove ${selectedIds.size} transactions?` : "Permanently remove this transaction?"}</p>
                      <div className="grid grid-cols-2 gap-3 w-full mt-8"><button onClick={() => setDeleteTarget(null)} className="px-4 py-3 bg-zinc-50 text-zinc-600 font-bold rounded-xl hover:bg-zinc-100 border border-zinc-100">Cancel</button><button onClick={executeDelete} className="px-4 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-600/20 active:scale-95">Delete</button></div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Transactions</h2><p className="text-sm text-zinc-500">Managing <span className="font-semibold text-indigo-600">{taxYearInfo.label}</span></p></div>
          <div className="flex gap-2 relative">
             <button onClick={() => setShowManualAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"><PlusCircle size={16}/> Manual Entry</button>
             <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors shadow-sm"><Download className="w-4 h-4" /> Export</button>
             {showExportMenu && (
                 <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-zinc-100 py-1 z-50 animate-fade-in-up">
                     <button onClick={() => exportXeroJournals(transactions, properties, taxYear)} className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Xero Manual Journals</button>
                     <button onClick={() => exportMTDBridging(transactions, properties, taxYear)} className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">MTD Bridging Format</button>
                     <button onClick={() => exportGeneric(transactions, properties, taxYear)} className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Generic CSV</button>
                 </div>
             )}
          </div>
      </div>

      <div className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-zinc-200 bg-white hover:border-indigo-300 hover:bg-zinc-50/50'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }} onClick={() => fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} accept=".csv,.pdf,image/*" />
        {isProcessing ? (
             <div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /><p className="text-sm font-medium text-zinc-600">AI Deduplication Processing...</p></div>
        ) : (
            <>
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 text-zinc-400 group-hover:text-indigo-500 group-hover:bg-indigo-50"><UploadCloud className="w-6 h-6" /></div>
                <h3 className="text-sm font-bold text-zinc-900">Upload Bank Statement</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">AI will extract and avoid duplicates.</p>
            </>
        )}
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
         <Search className="w-5 h-5 text-zinc-400 ml-2" />
         <input type="text" placeholder="Search transactions..." className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-400 text-zinc-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         <div className="h-6 w-px bg-zinc-200 mx-2"></div>
         <div className="flex items-center gap-2 pr-2"><span className="text-xs font-semibold text-zinc-500 uppercase">{visibleTransactions.length} Items</span></div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse text-sm">
                 <thead>
                     <tr className="bg-zinc-50/50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                         <th className="px-6 py-4 w-10"><input type="checkbox" className="rounded border-zinc-300 text-indigo-600" checked={selectedIds.size > 0 && selectedIds.size === visibleTransactions.length} onChange={handleSelectAll}/></th>
                         <th className="px-6 py-4">Date</th>
                         <th className="px-6 py-4">Description</th>
                         <th className="px-6 py-4">Property</th>
                         <th className="px-6 py-4">Category</th>
                         <th className="px-6 py-4 text-right">Amount</th>
                         <th className="px-6 py-4 text-center">Actions</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-50">
                     {visibleTransactions.map((t) => (
                         <tr key={t.id} className={`hover:bg-zinc-50/80 transition-colors group ${selectedIds.has(t.id) ? 'bg-indigo-50/30' : ''}`}>
                             <td className="px-6 py-4"><input type="checkbox" className="rounded border-zinc-300 text-indigo-600" checked={selectedIds.has(t.id)} onChange={() => handleSelect(t.id)}/></td>
                             <td className="px-6 py-4 whitespace-nowrap text-zinc-500 font-medium tabular-nums">{t.date}</td>
                             <td className="px-6 py-4">
                                 <div className="flex items-center gap-2"><div className="font-medium text-zinc-900 line-clamp-1">{t.description}</div>{t.tag && <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${t.tag === 'D' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>{t.tag}</span>}</div>
                                 <div className="flex items-center gap-2 mt-1">{t.source === 'bank_upload' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">Auto-Import</span>}{t.source === 'manual' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600">Manual Entry</span>}{t.matchedInvoiceId && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"><Paperclip size={10} /> Receipt</span>}</div>
                             </td>
                             <td className="px-6 py-4"><div className="relative"><select className="appearance-none bg-transparent hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded-lg py-1 pl-2 pr-6 text-xs font-medium text-zinc-600 focus:outline-none w-full max-w-[140px] truncate cursor-pointer" value={t.propertyId || ''} onChange={(e) => updateProperty(t.id, e.target.value)}><option value="">Select...</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" /></div></td>
                             <td className="px-6 py-4"><div className="relative"><select className={`appearance-none rounded-lg py-1 pl-2 pr-6 text-xs font-medium focus:outline-none w-full max-w-[180px] border ${t.category === HMRCCategory.UNCATEGORIZED ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 hover:border-zinc-200'}`} value={t.category} onChange={(e) => updateCategory(t.id, e.target.value as HMRCCategory)}>{Object.entries(CategoryLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${t.category === HMRCCategory.UNCATEGORIZED ? 'text-amber-500' : 'text-zinc-400'}`} /></div></td>
                             <td className={`px-6 py-4 text-right font-bold tabular-nums ${t.amount > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>{t.amount > 0 ? '+' : ''}£{Math.abs(t.amount).toFixed(2)}</td>
                             <td className="px-6 py-4 text-center"><button onClick={() => setDeleteTarget(t.id)} className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                         </tr>
                     ))}
                     {visibleTransactions.length === 0 && (<tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400 italic">No transactions found.</td></tr>)}
                 </tbody>
             </table>
         </div>
      </div>

      {selectedIds.size > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 glass px-6 py-4 rounded-2xl shadow-2xl border border-zinc-200 flex items-center gap-6 animate-fade-in-up z-40">
              <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">{selectedIds.size}</span><span className="text-sm font-bold text-zinc-900">Selected</span></div>
              <div className="h-8 w-px bg-zinc-200"></div>
              <div className="flex items-center gap-2">
                  <button onClick={() => bulkApplyTag('D')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"><UserPlus size={14} /> Tag D</button>
                  <button onClick={() => bulkApplyTag('J')} className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-100 transition-colors border border-violet-100"><UserPlus size={14} /> Tag J</button>
                  <button onClick={() => bulkApplyTag(undefined)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-700 text-xs font-bold hover:bg-zinc-100 rounded-xl transition-colors">Clear Tags</button>
                  <div className="h-6 w-px bg-zinc-200 mx-2"></div>
                  <button onClick={() => setDeleteTarget('bulk')} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors border border-rose-100"><Trash2 size={14} /> Delete</button>
              </div>
              <div className="h-8 w-px bg-zinc-200"></div>
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"><X size={18} /></button>
          </div>
      )}
    </div>
  );
};
