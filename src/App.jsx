import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MetricsCards from './components/MetricsCards';
import UploadForm from './components/UploadForm';
import TransactionTable from './components/TransactionTable';
import ImageModal from './components/ImageModal';
import BackendSetupModal from './components/BackendSetupModal';
import LoginScreen from './components/LoginScreen';
import { submitTransaction, getWebhookUrl } from './services/sheetsService';
import { isAuthenticated, logout, getCurrentUser } from './services/authService';
import { Database, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

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

  // Clear demo data
  useEffect(() => {
    localStorage.removeItem('paylens_saved_transactions');
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
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

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

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
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
      showToast('Record saved to Dashboard! Setup Google Sheets Webhook to sync to the cloud.', 'info');
    } else if (sheetsResult.success) {
      showToast('Successfully recorded & synced to Google Sheets!', 'success');
    } else {
      showToast(`Saved locally. Notice: ${sheetsResult.message}`, 'warning');
    }

    return sheetsResult;
  };

  const handleDeleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('Transaction removed from list', 'info');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all transactions from the table?')) {
      setTransactions([]);
      localStorage.removeItem(STORAGE_KEY_TXS);
      showToast('All transaction records cleared', 'info');
    }
  };

  // If not authenticated, render LoginScreen with Welcome Splash Animation
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
        onOpenBackendModal={() => setIsBackendModalOpen(true)}
        transactionsCount={transactions.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        onLogout={handleLogout}
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
                  Connect Google Sheets as your Live Database
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Deploy our copy-paste Google Apps Script snippet to automatically log every payment into your Google Sheet.
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
              Encrypted Local Session
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
        onWebhookUpdated={(url) => setWebhookUrlState(url)}
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
