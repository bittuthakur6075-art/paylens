import React from 'react';
import { 
  Receipt, Database, Settings, ShieldCheck, Sun, Moon, LogOut, RefreshCw 
} from 'lucide-react';

export default function Navbar({ 
  webhookUrl, 
  onOpenBackendModal, 
  transactionsCount,
  theme = 'dark',
  onToggleTheme,
  user,
  onLogout,
  isSyncing = false,
  onSync,
  lastSyncTime
}) {
  const isConnected = !!webhookUrl;
  const displayName = user?.fullName || 'PRADEEP KUMAR SHARMA';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                PayLens
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                Vault
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Payment Screenshot Extractor &amp; Ledger
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Profile Pill */}
          <div 
            onClick={onOpenBackendModal}
            title="Click to manage account & security settings"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
              {displayName.charAt(0)}
            </div>
            <span className="max-w-[170px] truncate tracking-tight">{displayName}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          </div>

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
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-500 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-semibold hidden lg:inline">
                {isSyncing ? 'Syncing...' : 'Sync'}
              </span>
            </button>
          )}

          {/* Dark / Light Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition transform rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 transition transform rotate-0 hover:-rotate-12" />
            )}
          </button>

          {/* Backend Status Badge & Setup Trigger */}
          <button
            onClick={onOpenBackendModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500'
            }`} />
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isConnected ? 'Sheets Live' : 'Connect Sheets'}
            </span>
            <span className="sm:hidden">
              {isConnected ? 'Live' : 'Setup'}
            </span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenBackendModal}
            title="Configure Backend & Security"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Lock Vault & Log Out (Data remains safe in cloud)"
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
