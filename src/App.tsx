import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, FileText, Receipt, Calculator, Building2, CalendarClock, 
  Loader2, Menu, Cloud, Settings, RefreshCw, X, Database, ExternalLink, 
  Save, Info, CheckCircle, Download as CloudDownload
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { TransactionManager } from './components/TransactionManager';
import { InvoiceManager } from './components/InvoiceManager';
import { TaxEstimator } from './components/TaxEstimator';
import { Transaction, Invoice, Property, TaxYear, TAX_YEARS, getTaxYearDates } from './types';
import { 
  loadTransactions, loadInvoices, loadTaxYear, loadProperties,
  saveTransactions, saveInvoices, saveTaxYear, saveProperties 
} from './services/storageService';
import { syncToCloud, loadFromCloud } from './services/cloudStorageService';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'local' | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'invoices' | 'tax'>('dashboard');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [taxYear, setTaxYear] = useState<TaxYear>('2024-2025');
  
  const [cloudUrl, setCloudUrl] = useState<string>(localStorage.getItem('cloud_sync_url') || '');
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('last_cloud_sync'));
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Cloud-first loading on startup
  useEffect(() => {
    const initData = async () => {
      const savedUrl = localStorage.getItem('cloud_sync_url');
      
      // Try cloud first if URL is configured
      if (savedUrl) {
        try {
          console.log('[App] Attempting cloud load...');
          const cloudData = await loadFromCloud(savedUrl);
          
          if (cloudData && (cloudData.transactions?.length > 0 || cloudData.invoices?.length > 0 || cloudData.properties?.length > 0)) {
            console.log('[App] Cloud data loaded successfully');
            setTransactions(cloudData.transactions || []);
            setInvoices(cloudData.invoices || []);
            setProperties(cloudData.properties || []);
            if (cloudData.lastSync || cloudData.timestamp) {
              setLastSync(cloudData.lastSync || cloudData.timestamp || null);
            }
            setDataSource('cloud');
            
            // Cache to IndexedDB as backup
            await Promise.all([
              saveTransactions(cloudData.transactions || []),
              saveInvoices(cloudData.invoices || []),
              saveProperties(cloudData.properties || [])
            ]);
            
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('[App] Cloud load failed, falling back to local:', e);
        }
      }
      
      // Fallback to IndexedDB
      try {
        console.log('[App] Loading from IndexedDB...');
        const [savedTransactions, savedInvoices, savedYear, savedProperties] = await Promise.all([
          loadTransactions(),
          loadInvoices(),
          loadTaxYear(),
          loadProperties()
        ]);
        if (savedTransactions.length > 0) setTransactions(savedTransactions);
        if (savedInvoices.length > 0) setInvoices(savedInvoices);
        if (savedYear) setTaxYear(savedYear);
        if (savedProperties.length > 0) setProperties(savedProperties);
        setDataSource('local');
      } catch (e) {
        console.error('[App] Local Load Error:', e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Save locally on change
  useEffect(() => { if (!loading) saveTransactions(transactions); }, [transactions, loading]);
  useEffect(() => { if (!loading) saveInvoices(invoices); }, [invoices, loading]);
  useEffect(() => { if (!loading) saveProperties(properties); }, [properties, loading]);
  useEffect(() => { if (!loading) saveTaxYear(taxYear); }, [taxYear, loading]);

  // Pull fresh data from cloud
  const handleCloudPull = async () => {
    if (!cloudUrl) {
      setShowSettings(true);
      return;
    }
    setSyncing(true);
    try {
      const cloudData = await loadFromCloud(cloudUrl);
      if (cloudData) {
        setTransactions(cloudData.transactions || []);
        setInvoices(cloudData.invoices || []);
        setProperties(cloudData.properties || []);
        setLastSync(new Date().toISOString());
        setDataSource('cloud');
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      } else {
        alert('No data found in cloud. Push your local data first.');
      }
    } catch (e) {
      console.error('[App] Pull Failed:', e);
      alert('Failed to pull from cloud. Check your URL and try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Push data to cloud
  const handleManualSync = async () => {
    if (!cloudUrl) {
      setShowSettings(true);
      return;
    }
    setSyncing(true);
    setSyncSuccess(false);
    try {
      const result = await syncToCloud(cloudUrl, { transactions, invoices, properties });
      if (result.success) {
        setLastSync(result.timestamp || new Date().toISOString());
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      } else {
        throw new Error('Sync returned failure');
      }
    } catch (e) {
      console.error('[App] Sync Failed:', e);
      alert('Sync may have failed. Check your Google Sheet to verify.');
    } finally {
      setSyncing(false);
    }
  };

  const taxYearInfo = getTaxYearDates(taxYear);

  const renderContent = () => {
    return (
      <div className="space-y-6">
        {activeTab === 'dashboard' && (
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                syncing ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200' : 
                syncSuccess ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 
                'bg-zinc-50 text-zinc-400'
              }`}>
                {syncing ? <RefreshCw className="animate-spin" /> : syncSuccess ? <CheckCircle /> : <Cloud size={28} />}
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-lg tracking-tight">Google Drive Sync</h3>
                <p className="text-xs text-zinc-500 font-medium">
                  {lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : 'Not synced yet'}
                  {dataSource && <span className="ml-2 text-zinc-400">• Data from {dataSource}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={handleCloudPull}
                disabled={syncing}
                className="flex items-center justify-center gap-2 px-4 py-3.5 font-bold rounded-2xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-all disabled:opacity-50"
                title="Pull from Drive"
              >
                <CloudDownload size={18} />
                Pull
              </button>
              <button 
                onClick={handleManualSync}
                disabled={syncing}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3.5 font-bold rounded-2xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${
                  syncSuccess ? 'bg-emerald-600 text-white shadow-emerald-900/10' : 
                  'bg-zinc-900 text-white shadow-zinc-900/10 hover:bg-zinc-800'
                }`}
              >
                {syncing ? <Loader2 size={18} className="animate-spin" /> : syncSuccess ? <CheckCircle size={18} /> : <Save size={18} />}
                {syncing ? 'Syncing...' : syncSuccess ? 'Success!' : 'Push to Drive'}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-3.5 bg-zinc-100 text-zinc-600 rounded-2xl hover:bg-zinc-200 transition-all border border-zinc-200"
                title="Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && <Dashboard transactions={transactions} properties={properties} setProperties={setProperties} taxYear={taxYear} />}
        {activeTab === 'transactions' && <TransactionManager transactions={transactions} setTransactions={setTransactions} invoices={invoices} setInvoices={setInvoices} properties={properties} taxYear={taxYear} />}
        {activeTab === 'invoices' && <InvoiceManager invoices={invoices} setInvoices={setInvoices} transactions={transactions} setTransactions={setTransactions} taxYear={taxYear} />}
        {activeTab === 'tax' && <TaxEstimator transactions={transactions} taxYear={taxYear} />}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Building2 className="w-12 h-12 text-indigo-600" />
          <p className="text-zinc-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex overflow-hidden">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-[#18181b] text-white flex flex-col transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-8 pb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight leading-none">
              RentalTax<span className="text-indigo-400">AI</span>
            </h1>
            <p className="text-[10px] text-zinc-400 font-medium tracking-wider mt-1 uppercase">MTD Ready</p>
          </div>
        </div>
        
        {/* Tax Year Selector */}
        <div className="px-6 py-4">
          <div className="bg-zinc-800/50 rounded-xl p-1 border border-zinc-700/50 flex flex-col relative">
            <CalendarClock className="absolute top-3 left-3 w-4 h-4 text-zinc-400" />
            <select 
              value={taxYear} 
              onChange={(e) => setTaxYear(e.target.value as TaxYear)} 
              className="w-full bg-transparent text-zinc-200 text-xs font-medium rounded-lg pl-9 pr-2 py-2.5 focus:outline-none cursor-pointer appearance-none"
            >
              {TAX_YEARS.map(year => (
                <option key={year} value={year} className="bg-zinc-800 text-white">
                  {getTaxYearDates(year).label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Overview" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<FileText size={20} />} 
            label="Transactions" 
            active={activeTab === 'transactions'} 
            onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Receipt size={20} />} 
            label="Receipt Hub" 
            active={activeTab === 'invoices'} 
            onClick={() => { setActiveTab('invoices'); setMobileMenuOpen(false); }} 
          />
          <div className="my-6 border-t border-zinc-800/50 mx-4"></div>
          <SidebarItem 
            icon={<Calculator size={20} />} 
            label="Tax Estimator" 
            active={activeTab === 'tax'} 
            onClick={() => { setActiveTab('tax'); setMobileMenuOpen(false); }} 
          />
        </nav>
        
        {/* Footer */}
        <div className="p-4 mt-auto space-y-2">
          <button 
            onClick={() => setShowSettings(true)} 
            className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800/50 text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-800 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4" /> Cloud Config
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-screen overflow-hidden bg-zinc-50/50">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 font-bold text-zinc-900">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <span>RentalTax<span className="text-indigo-500">AI</span></span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-zinc-100 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Database size={20}/>
                </div>
                <h3 className="text-xl font-bold text-zinc-900">Cloud Sync Setup</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 pl-1">
                  Web App Deployment URL
                </label>
                <input 
                  type="text" 
                  placeholder="https://script.google.com/macros/s/.../exec" 
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={cloudUrl} 
                  onChange={(e) => { 
                    setCloudUrl(e.target.value); 
                    localStorage.setItem('cloud_sync_url', e.target.value); 
                  }} 
                />
              </div>
              
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                  <Info size={14} /> Setup Instructions
                </div>
                <ol className="text-[11px] text-amber-800 leading-relaxed font-medium list-decimal pl-4 space-y-2">
                  <li>Create a new Google Apps Script project</li>
                  <li>Paste the provided script code</li>
                  <li>Run the <strong>"setup"</strong> function to authorize</li>
                  <li>Deploy as Web App with access set to <strong>"Anyone"</strong></li>
                  <li>Copy the deployment URL and paste above</li>
                </ol>
              </div>
              
              <button 
                onClick={() => setShowSettings(false)} 
                className="w-full bg-zinc-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-zinc-900/20 hover:bg-zinc-800 transition-all"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 group relative ${
      active 
        ? 'text-white bg-white/10 shadow-inner' 
        : 'text-zinc-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
    )}
    <span className={`transition-transform duration-300 ${
      active ? 'scale-110 text-indigo-300' : 'group-hover:scale-110 group-hover:text-indigo-300'
    }`}>
      {icon}
    </span>
    <span>{label}</span>
  </button>
);

export default App;
