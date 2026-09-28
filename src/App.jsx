import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import UploadForm from './components/UploadForm';
import TransactionTable from './components/TransactionTable';
import ImageModal from './components/ImageModal';
import LoginScreen from './components/LoginScreen';
import PowerBiDashboard from './components/PowerBiDashboard';
import SpotlightSearchModal from './components/SpotlightSearchModal';

// Dedicated Full Pages
import ReportsPage from './pages/ReportsPage';
import CloudSyncPage from './pages/CloudSyncPage';
import DatabasePage from './pages/DatabasePage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ImportStatementPage from './pages/ImportStatementPage';

import { 
  submitTransaction, 
  getWebhookUrl, 
  fetchTransactions, 
  deleteCloudTransaction, 
  clearAllCloudTransactions 
} from './services/sheetsService';
import {
  isSupabaseConfigured,
  fetchSupabaseTransactions,
  insertSupabaseTransaction,
  insertBatchSupabaseTransactions,
  deleteSupabaseTransaction,
  clearAllSupabaseTransactions,
  subscribeToTransactions
} from './services/supabaseService';
import { isAuthenticated, logout, getCurrentUser } from './services/authService';
import { warmupOCR } from './services/ocrService';
import { Database, Sparkles, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

const STORAGE_KEY_TXS = 'paylens_clean_transactions';
const STORAGE_KEY_THEME = 'paylens_theme';

export default function App() {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(() => isAuthenticated());
  const [user, setUser] = useState(() => getCurrentUser());

  // Dark / White (Light) Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  });

  // Active view page: 'dashboard' | 'all' | 'ledger' | 'upload' | 'reports' | 'sync' | 'database' | 'users' | 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Sidebar collapsible state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Spotlight search modal state
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);

  // Apply theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  // Pre-warm OCR engine on application boot
  useEffect(() => {
    warmupOCR();
  }, []);

  // Load transactions from localStorage or start with empty list
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TXS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved transactions:', e);
    }
    return [];
  });

  const [webhookUrl, setWebhookUrlState] = useState(getWebhookUrl());
  const [selectedTransactionForModal, setSelectedTransactionForModal] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Cloud Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [needsScriptUpdate, setNeedsScriptUpdate] = useState(false);
  const [supabaseTableMissing, setSupabaseTableMissing] = useState(false);

  // Global keyboard shortcut listener for Ctrl+K or /
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        setIsSpotlightOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync transactions state changes to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(transactions));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
      const lightweight = transactions.map(t => ({
        ...t,
        screenshotUrl: t.screenshotUrl?.length > 100000 ? '[Stored Remotely]' : t.screenshotUrl
      }));
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(lightweight));
    }
  }, [transactions]);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  /**
   * Sync transactions with cloud backend (Supabase with Google Sheets fallback)
   */
  const syncWithCloud = useCallback(async (isManual = false) => {
    setIsSyncing(true);
    let synced = false;

    // 1. Try Supabase first (fastest, real-time, no CORS)
    if (isSupabaseConfigured()) {
      try {
        const supaResult = await fetchSupabaseTransactions();
        if (supaResult.success && Array.isArray(supaResult.transactions)) {
          setTransactions(supaResult.transactions);
          setLastSyncTime(new Date());
          setSupabaseTableMissing(false);
          synced = true;
          if (isManual) {
            showToast(`Supabase synced! ${supaResult.transactions.length} records verified.`, 'success');
          }
        } else if (supaResult.tableMissing) {
          setSupabaseTableMissing(true);
        }
      } catch (err) {
        console.warn('Supabase sync exception:', err);
      }
    }

    // 2. Fallback to Google Sheets if Supabase didn't complete sync
    if (!synced && webhookUrl) {
      try {
        const result = await fetchTransactions(webhookUrl);
        if (result.success && Array.isArray(result.transactions)) {
          setTransactions(prevLocal => {
            const cloudTxs = result.transactions;
            const cloudIds = new Set(
              cloudTxs.map(t => t.transactionId).filter(id => id && id !== 'N/A')
            );
            const pendingLocal = prevLocal.filter(l => !l.synced && !cloudIds.has(l.transactionId));
            return [...pendingLocal, ...cloudTxs];
          });
          setLastSyncTime(new Date());
          setNeedsScriptUpdate(false);
          if (isManual) {
            showToast(`Google Sheets sync complete! ${result.transactions.length} records loaded.`, 'success');
          }
        } else if (result.needsScriptUpdate) {
          setNeedsScriptUpdate(true);
        }
      } catch (err) {
        console.warn('Sheets sync error:', err);
      }
    }

    setIsSyncing(false);
  }, [webhookUrl]);

  // Initial cloud sync on login or mount
  useEffect(() => {
    if (isLoggedIn) {
      syncWithCloud(false);
    }
  }, [isLoggedIn, syncWithCloud]);

  // Auto-sync when user returns to this window/tab on any device
  useEffect(() => {
    const handleFocus = () => {
      if (isLoggedIn && !isSyncing) {
        syncWithCloud(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoggedIn, isSyncing, syncWithCloud]);

  // Real-time Supabase subscription across devices
  useEffect(() => {
    if (!isLoggedIn || !isSupabaseConfigured()) return;

    const unsubscribe = subscribeToTransactions(
      (newTx) => {
        setTransactions(prev => {
          if (prev.some(t => t.id === newTx.id || (t.transactionId && t.transactionId === newTx.transactionId))) {
            return prev;
          }
          return [newTx, ...prev];
        });
        showToast(`Real-time update: Received ${newTx.appName} transaction!`, 'info');
      },
      (deletedId) => {
        if (deletedId) {
          setTransactions(prev => prev.filter(t => t.id !== deletedId));
        }
      }
    );

    return () => unsubscribe?.();
  }, [isLoggedIn]);

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    showToast('Logged out securely.', 'info');
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Submit transaction handler (syncs to Supabase and Google Sheets)
  const handleSubmitTransaction = async (newTx) => {
    let savedRecord = { ...newTx, timestamp: new Date().toISOString() };
    let savedSuccessfully = false;

    // 1. Save to Supabase
    if (isSupabaseConfigured()) {
      const supaRes = await insertSupabaseTransaction(newTx);
      if (supaRes.success && supaRes.record) {
        savedRecord = supaRes.record;
        savedSuccessfully = true;
      }
    }

    // 2. Also send to Google Sheets if configured
    if (webhookUrl) {
      submitTransaction(newTx, webhookUrl).catch(console.warn);
    }

    savedRecord.synced = true;
    setTransactions(prev => [savedRecord, ...prev]);

    if (savedSuccessfully) {
      showToast('Successfully recorded & synced to cloud database!', 'success');
    } else {
      showToast('Saved to local dashboard and synced.', 'info');
    }

    return { success: true };
  };

  // Batch import transactions from Statement (PDF, Excel, CSV, JSON)
  const handleBatchImportTransactions = async (newRecords = []) => {
    if (!newRecords || newRecords.length === 0) return;

    let savedRecords = [...newRecords];
    let syncedToSupabase = false;

    // 1. Batch save to Supabase if configured
    if (isSupabaseConfigured()) {
      const supaRes = await insertBatchSupabaseTransactions(newRecords);
      if (supaRes.success && Array.isArray(supaRes.records)) {
        savedRecords = supaRes.records;
        syncedToSupabase = true;
      }
    }

    // 2. Queue sync to Google Sheets if configured
    if (webhookUrl) {
      newRecords.forEach(rec => {
        submitTransaction(rec, webhookUrl).catch(console.warn);
      });
    }

    setTransactions(prev => [...savedRecords, ...prev]);

    if (syncedToSupabase) {
      showToast(`Imported ${newRecords.length} transactions and synced to Supabase!`, 'success');
    } else {
      showToast(`Imported ${newRecords.length} transactions to Ledger!`, 'success');
    }
  };

  const handleDeleteTransaction = async (id) => {
    const target = transactions.find(t => t.id === id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('Transaction removed from list', 'info');

    if (isSupabaseConfigured()) {
      deleteSupabaseTransaction(id, target?.transactionId).catch(console.warn);
    }

    if (target && webhookUrl) {
      deleteCloudTransaction(target.transactionId, target.timestamp, webhookUrl).catch(console.warn);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all transactions from the table and cloud database?')) {
      setTransactions([]);
      localStorage.removeItem(STORAGE_KEY_TXS);
      showToast('All transaction records cleared', 'info');

      if (isSupabaseConfigured()) {
        clearAllSupabaseTransactions().catch(console.warn);
      }
      if (webhookUrl) {
        clearAllCloudTransactions(webhookUrl).catch(console.warn);
      }
    }
  };

  // Toggle sidebar function
  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarMobileOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => !prev);
    }
  };

  // If not authenticated, render LoginScreen
  if (!isLoggedIn) {
    return (
      <LoginScreen
        onLoginSuccess={(authedUser) => {
          setUser(authedUser);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* 1. Left Sidebar Navigation (Collapsible & Responsive) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSearch={() => setIsSpotlightOpen(true)}
        transactionsCount={transactions.length}
        isSyncing={isSyncing}
        onSync={() => syncWithCloud(true)}
        webhookUrl={webhookUrl}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarMobileOpen}
        onClose={() => setIsSidebarMobileOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* 2. Main Content Canvas (Dynamically offsets when sidebar is open) */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-72'
      }`}>
        {/* Top Header Navbar */}
        <Navbar
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          activeTab={activeTab}
          webhookUrl={webhookUrl}
          onOpenBackendModal={() => setActiveTab('settings')}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          isSyncing={isSyncing}
          onSync={() => syncWithCloud(true)}
          lastSyncTime={lastSyncTime}
          onOpenSearch={() => setIsSpotlightOpen(true)}
        />

        {/* Main Body: Renders the active dedicated page */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Banner if Supabase table is missing */}
          {supabaseTableMissing && activeTab !== 'database' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-emerald-500/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide">
                    Complete Supabase Setup: Run 1-Click SQL Query
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300/80">
                    Supabase is connected! Run the ready-to-use SQL script in your Database Studio to initialize tables.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('database')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                Open Database Studio
              </button>
            </div>
          )}

          {/* PAGE 1: Power BI Analytics Dashboard */}
          {activeTab === 'dashboard' && (
            <section aria-label="Power BI Interactive Analytics">
              <PowerBiDashboard
                transactions={transactions}
                onOpenSearch={() => setIsSpotlightOpen(true)}
              />
            </section>
          )}

          {/* PAGE 2: All-in-One Multi-Pane Cockpit */}
          {activeTab === 'all' && (
            <div className="space-y-6">
              <PowerBiDashboard
                transactions={transactions}
                onOpenSearch={() => setIsSpotlightOpen(true)}
              />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-5" aria-label="Upload Form">
                  <UploadForm
                    onSubmitTransaction={handleSubmitTransaction}
                    onViewImage={(tx) => setSelectedTransactionForModal(tx)}
                    webhookUrl={webhookUrl}
                  />
                </section>
                <section className="lg:col-span-7" aria-label="Ledger Table">
                  <TransactionTable
                    transactions={transactions}
                    onViewImage={(tx) => setSelectedTransactionForModal(tx)}
                    onDeleteTransaction={handleDeleteTransaction}
                    onClearAll={handleClearAll}
                    isSyncing={isSyncing}
                    onSync={() => syncWithCloud(true)}
                    needsScriptUpdate={needsScriptUpdate}
                    onOpenBackendModal={() => setActiveTab('sync')}
                  />
                </section>
              </div>
            </div>
          )}

          {/* PAGE 3: Full-width Transaction Ledger */}
          {activeTab === 'ledger' && (
            <section aria-label="Transactions Ledger">
              <TransactionTable
                transactions={transactions}
                onViewImage={(tx) => setSelectedTransactionForModal(tx)}
                onDeleteTransaction={handleDeleteTransaction}
                onClearAll={handleClearAll}
                isSyncing={isSyncing}
                onSync={() => syncWithCloud(true)}
                needsScriptUpdate={needsScriptUpdate}
                onOpenBackendModal={() => setActiveTab('sync')}
                onOpenImport={() => setActiveTab('import')}
              />
            </section>
          )}

          {/* PAGE: Statement Ingestion & Analytics Studio */}
          {activeTab === 'import' && (
            <section aria-label="Statement Ingestion Studio">
              <ImportStatementPage
                existingTransactions={transactions}
                onImportSuccess={handleBatchImportTransactions}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            </section>
          )}

          {/* PAGE 4: Dedicated Upload & OCR Workbench */}
          {activeTab === 'upload' && (
            <section aria-label="Receipt OCR Workbench" className="max-w-3xl mx-auto">
              <UploadForm
                onSubmitTransaction={handleSubmitTransaction}
                onViewImage={(tx) => setSelectedTransactionForModal(tx)}
                webhookUrl={webhookUrl}
                onSwitchToImport={() => setActiveTab('import')}
              />
            </section>
          )}

          {/* PAGE 5: Reports & Statements Export */}
          {activeTab === 'reports' && (
            <section aria-label="Reports & Statements">
              <ReportsPage transactions={transactions} />
            </section>
          )}

          {/* PAGE 6: Cloud & Multi-Device Sync Center */}
          {activeTab === 'sync' && (
            <section aria-label="Cloud Sync Center">
              <CloudSyncPage
                webhookUrl={webhookUrl}
                onWebhookUpdated={(url) => {
                  setWebhookUrlState(url);
                  syncWithCloud(true);
                }}
                isSyncing={isSyncing}
                onSync={() => syncWithCloud(true)}
                lastSyncTime={lastSyncTime}
                transactionsCount={transactions.length}
              />
            </section>
          )}

          {/* PAGE 7: PostgreSQL Database & SQL Studio */}
          {activeTab === 'database' && (
            <section aria-label="Database Studio">
              <DatabasePage onDatabaseUpdated={() => syncWithCloud(true)} />
            </section>
          )}

          {/* PAGE 8: Team Users & Access Control */}
          {activeTab === 'users' && (
            <section aria-label="Users & Access Control">
              <UsersPage currentUser={user} onUsersUpdated={() => syncWithCloud(false)} />
            </section>
          )}

          {/* PAGE 9: Account & Security Settings */}
          {activeTab === 'settings' && (
            <section aria-label="Account Settings">
              <SettingsPage
                currentUser={user}
                onUserUpdated={(u) => {
                  setUser(u);
                  showToast('Profile updated successfully!', 'success');
                }}
                theme={theme}
                onToggleTheme={handleToggleTheme}
                transactions={transactions}
              />
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-5 text-center text-xs text-slate-500 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                PayLens Vault • Active User: <strong className="text-slate-900 dark:text-white">{user?.fullName || 'Bittu Thakur'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <button 
                onClick={() => setIsSpotlightOpen(true)}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Spotlight Search (Ctrl+K)
              </button>
              <span>•</span>
              <button 
                onClick={() => setActiveTab('settings')}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Security &amp; Cloud
              </button>
              <span>•</span>
              <span className="flex items-center gap-1">
                {lastSyncTime ? `Synced ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Protected'}
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* Spotlight Instant Search Modal (Ctrl + K) */}
      <SpotlightSearchModal
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        transactions={transactions}
        onViewImage={(tx) => {
          setIsSpotlightOpen(false);
          setSelectedTransactionForModal(tx);
        }}
        onSelectTransaction={(tx) => {
          setIsSpotlightOpen(false);
          if (tx.screenshotUrl) {
            setSelectedTransactionForModal(tx);
          }
        }}
      />

      {/* Screenshot Verification Modal */}
      <ImageModal
        isOpen={!!selectedTransactionForModal}
        transaction={selectedTransactionForModal}
        onClose={() => setSelectedTransactionForModal(null)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : toastMessage.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
              : 'bg-blue-950/90 border-blue-500/40 text-blue-200'
          }`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
