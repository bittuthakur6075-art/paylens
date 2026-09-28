import React from 'react';
import { 
  Menu, Database, Settings, Sun, Moon, RefreshCw, Search, ShieldCheck,
  PanelLeft, PanelLeftOpen
} from 'lucide-react';
import PayLensLogo from './PayLensLogo';

export default function Navbar({ 
  onToggleSidebar,
  isSidebarCollapsed,
  activeTab = 'dashboard',
  webhookUrl, 
  onOpenBackendModal, 
  theme = 'dark',
  onToggleTheme,
  isSyncing = false,
  onSync,
  lastSyncTime,
  onOpenSearch
}) {
  const isConnected = !!webhookUrl;

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Analytics Dashboard';
      case 'all':
        return 'All-in-One Cockpit';
      case 'ledger':
        return 'Transactions Ledger';
      case 'upload':
        return 'OCR Scanner Workbench';
      case 'reports':
        return 'Reports & Statements';
      case 'sync':
        return 'Cloud & Device Sync';
      case 'database':
        return 'Database & SQL Studio';
      case 'users':
        return 'Users & Access Control';
      case 'settings':
        return 'Account & Security Settings';
      case 'sale-order':
        return 'Sale Order Studio';
      default:
        return 'Analytics Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Visual financial intelligence & interactive slicers';
      case 'all':
        return 'Complete multi-pane financial cockpit';
      case 'ledger':
        return 'Full ledger records with search & duplicate detection';
      case 'upload':
        return 'Automated payment screenshot extraction & verification';
      case 'reports':
        return 'Export custom statements to Excel, CSV, or PDF';
      case 'sync':
        return 'Real-time sync between Google Sheets and Supabase';
      case 'database':
        return 'PostgreSQL tables, storage buckets & SQL queries';
      case 'users':
        return 'Team accounts, roles & multi-device credentials';
      case 'settings':
        return 'Profile details, passwords, AI keys & preferences';
      case 'sale-order':
        return 'Create GST sale orders, calculate taxes & download PDF';
      default:
        return 'Real-time payment data & OCR processing';
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Sidebar Toggle Button (Desktop & Mobile) + Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition flex items-center justify-center"
          >
            <PanelLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>

          {isSidebarCollapsed && (
            <div className="hidden lg:flex items-center pr-3 border-r border-slate-200 dark:border-slate-800">
              <PayLensLogo className="h-7 w-auto max-w-[125px]" showText={true} />
            </div>
          )}

          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {getPageTitle()}
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {getPageSubtitle()}
            </p>
          </div>
        </div>

        {/* Center: Search Data Pill (Desktop) */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            title="Instant Spotlight Search (Ctrl + K)"
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-xs transition max-w-sm w-full"
          >
            <Search className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="flex-1 text-left">Search transactions, UTR, people...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-500">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Right Action Tools */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Spotlight Search Mobile Icon */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              title="Search Data (Ctrl + K)"
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              <Search className="w-4 h-4 text-blue-500" />
            </button>
          )}

          {/* Cloud Sync Refresh Button */}
          {isConnected && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              title={
                isSyncing 
                  ? 'Syncing across devices...' 
                  : lastSyncTime 
                  ? `Synced at ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Click to refresh.` 
                  : 'Sync data with Google Sheets'
              }
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isSyncing ? 'Syncing...' : 'Sync'}
              </span>
            </button>
          )}

          {/* Dark / Light Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 transition"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition" />
            ) : (
              <Moon className="w-4 h-4 text-blue-600 transition" />
            )}
          </button>

          {/* Backend Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold select-none ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500'
            }`} />
            <span className="hidden sm:inline">
              {isConnected ? 'Sheets Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
