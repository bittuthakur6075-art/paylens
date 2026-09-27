import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import MetricsCards from './components/MetricsCards';
import UploadForm from './components/UploadForm';
import TransactionTable from './components/TransactionTable';
import ImageModal from './components/ImageModal';
import BackendSetupModal from './components/BackendSetupModal';
import LoginScreen from './components/LoginScreen';
import { 
  submitTransaction, 
  getWebhookUrl, 
  fetchTransactions, 
  deleteCloudTransaction, 
  clearAllCloudTransactions 
} from './services/sheetsService';
import { isAuthenticated, logout, getCurrentUser } from './services/authService';
import { Database, Sparkles, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Cloud Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [needsScriptUpdate, setNeedsScriptUpdate] = useState(false);

  // Sync transactions state changes to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(transactions));
    } catch (e) {
      console.warn('LocalStorage save error (likely image size quota). Truncating heavy screenshot URLs:', e);
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
   * Sync transactions with Google Sheets cloud backend
   * Makes data visible across all devices (mobile, laptop, any browser)
   */
  const syncWithCloud = useCallback(async (isManual = false) => {
    if (!webhookUrl) return;

    setIsSyncing(true);
    try {
      const result = await fetchTransactions(webhookUrl);
      if (result.success && Array.isArray(result.transactions)) {
        setTransactions(prevLocal => {
          const cloudTxs = result.transactions;
          // Set of transaction IDs already in the cloud
          const cloudIds = new Set(
            cloudTxs.map(t => t.transactionId).filter(id => id && id !== 'N/A')
          );
          // Keep local pending transactions not yet in cloud
          const pendingLocal = prevLocal.filter(l => !l.synced && !cloudIds.has(l.transactionId));
          return [...pendingLocal, ...cloudTxs];
        });
        setLastSyncTime(new Date());
        setNeedsScriptUpdate(false);
        if (isManual) {
          showToast(`Cloud sync complete! ${result.transactions.length} records verified.`, 'success');
        }
      } else if (result.needsScriptUpdate) {
        setNeedsScriptUpdate(true);
        if (isManual) {
          showToast('Please update your Google Apps Script with doGet to sync across devices.', 'warning');
        }
      } else if (isManual) {
        showToast(result.message || 'Sync failed. Please check connection.', 'warning');
      }
    } catch (err) {
      console.warn('Sync error:', err);
      if (isManual) {
        showToast('Sync error occurred.', 'warning');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [webhookUrl]);

  // Initial cloud sync on login or mount
  useEffect(() => {
    if (isLoggedIn && webhookUrl) {
      syncWithCloud(false);
    }
  }, [isLoggedIn, webhookUrl, syncWithCloud]);

  // Auto-sync when user returns to this window/tab on any device
  useEffect(() => {
    const handleFocus = () => {
      if (isLoggedIn && webhookUrl && !isSyncing) {
        syncWithCloud(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoggedIn, webhookUrl, isSyncing, syncWithCloud]);

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    showToast('Logged out securely. Your data remains saved in Google Sheets.', 'info');
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Submit transaction handler (syncs to Google Sheets and appends to local list)
  const handleSubmitTransaction = async (newTx) => {
    const sheetsResult = await submitTransaction(newTx, webhookUrl);

    const transactionRecord = {
      ...newTx,
      synced: sheetsResult.success && !sheetsResult.simulated,
      timestamp: new Date().toISOString()
    };

    setTransactions(prev => [transactionRecord, ...prev]);

    if (sheetsResult.simulated) {
      showToast('Record saved to Dashboard! Setup Google Sheets Webhook to sync across devices.', 'info');
    } else if (sheetsResult.success) {
      showToast('Successfully recorded & synced to Google Sheets!', 'success');
      // Trigger cloud re-sync to get official drive URLs
      setTimeout(() => syncWithCloud(false), 2000);
    } else {
      showToast(`Saved locally. Notice: ${sheetsResult.message}`, 'warning');
    }

    return sheetsResult;
  };

  const handleDeleteTransaction = async (id) => {
    const target = transactions.find(t => t.id === id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('Transaction removed from list', 'info');

    if (target && webhookUrl) {
      try {
        await deleteCloudTransaction(target.transactionId, target.timestamp, webhookUrl);
      } catch (e) {
        console.warn('Cloud delete error:', e);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all transactions from the table and Google Sheet?')) {
      setTransactions([]);
      localStorage.removeItem(STORAGE_KEY_TXS);
      showToast('All transaction records cleared', 'info');

      if (webhookUrl) {
        try {
          await clearAllCloudTransactions(webhookUrl);
        } catch (e) {
          console.warn('Cloud clear error:', e);
        }
      }
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        webhookUrl={webhookUrl}
        onOpenBackendModal={() => setIsBackendModalOpen(false || true)}
        transactionsCount={transactions.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        onLogout={handleLogout}
        isSyncing={isSyncing}
        onSync={() => syncWithCloud(true)}
        lastSyncTime={lastSyncTime}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner notification if Google Sheets is not configured */}
        {!webhookUrl && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-indigo-50 dark:from-indigo-950/60 dark:via-slate-900 dark:to-indigo-950/60 border border-indigo-200 dark:border-indigo-500/20 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                  Connect Google Sheets as your Multi-Device Cloud Database
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Deploy our copy-paste Google Apps Script snippet so your transactions and login work on any mobile or PC.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsBackendModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Setup Google Sheet Webhook
            </button>
          </div>
        )}

        {/* Multi-device sync notice if script needs update */}
        {needsScriptUpdate && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide">
                  Update Google Apps Script for Multi-Device Sync
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                  To view your saved transactions and credentials from any other computer or mobile phone, update your Google Apps Script with <b>doGet</b>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsBackendModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 shadow-md shadow-amber-600/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              Update Script in 1 Min
            </button>
          </div>
        )}

        {/* Component 3: Summary Analytics Cards */}
        <section aria-label="Transaction Analytics">
          <MetricsCards transactions={transactions} />
        </section>

        {/* Component 1 & 2: Split Layout (Upload Form Left / Extracted Data Table Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Upload & Auto-Extractor */}
          <section className="lg:col-span-5" aria-label="Payment Screenshot Upload">
            <UploadForm
              onSubmitTransaction={handleSubmitTransaction}
              onViewImage={(tx) => setSelectedTransactionForModal(tx)}
              webhookUrl={webhookUrl}
            />
          </section>

          {/* Right Panel: Extracted Data Table & Controls */}
          <section className="lg:col-span-7" aria-label="Extracted Transactions Dashboard">
            <TransactionTable
              transactions={transactions}
              onViewImage={(tx) => setSelectedTransactionForModal(tx)}
              onDeleteTransaction={handleDeleteTransaction}
              onClearAll={handleClearAll}
              isSyncing={isSyncing}
              onSync={() => syncWithCloud(true)}
              needsScriptUpdate={needsScriptUpdate}
              onOpenBackendModal={() => setIsBackendModalOpen(true)}
            />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 py-6 text-center text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="font-medium text-slate-700 dark:text-slate-400">
              PayLens • Personal Financial Extractor for <strong className="text-slate-900 dark:text-slate-200">{user?.fullName || 'PRADEEP KUMAR SHARMA'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <button 
              onClick={() => setIsBackendModalOpen(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              Account &amp; Apps Script Settings
            </button>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              {lastSyncTime ? `Cloud Synced (${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'Encrypted Session'}
            </span>
          </div>
        </div>
      </footer>

      {/* Screenshot Verification Modal */}
      <ImageModal
        isOpen={!!selectedTransactionForModal}
        transaction={selectedTransactionForModal}
        onClose={() => setSelectedTransactionForModal(null)}
      />

      {/* Backend & Account Setup Modal */}
      <BackendSetupModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        onWebhookUpdated={(url) => {
          setWebhookUrlState(url);
          syncWithCloud(true);
        }}
        currentUser={user}
        onUserUpdated={(updatedUser) => {
          setUser(updatedUser);
          showToast('Security details updated successfully!', 'success');
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : toastMessage.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
              : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
          }`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
