import React, { useState } from 'react';
import PayLensLogo from './PayLensLogo';
import {
  LayoutGrid,
  BarChart3,
  Search,
  FileText,
  Upload,
  Download,
  Database,
  RefreshCw,
  Users,
  Settings,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  ChevronLeft,
  PanelLeftClose,
  PieChart,
  HardDrive,
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar({
  activeTab = 'dashboard',
  setActiveTab,
  onOpenSearch,
  transactionsCount = 0,
  isSyncing = false,
  onSync,
  webhookUrl,
  theme = 'dark',
  onToggleTheme,
  user,
  onLogout,
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const isConnected = !!webhookUrl;
  const displayName = user?.fullName || 'PRADEEP KUMAR SHARMA';
  const role = user?.role || 'Admin';

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (onClose) onClose();
  };

  const navItems = [
    {
      group: null, // Core
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, highlight: true },
        { id: 'all', label: 'All-in-One Cockpit', icon: BarChart3 },
        { id: 'search', label: 'Find Data', icon: Search, shortcut: 'Ctrl K', action: onOpenSearch }
      ]
    },
    {
      group: 'Transactions',
      items: [
        { id: 'ledger', label: 'Ledger Records', icon: FileText, count: transactionsCount },
        { id: 'import', label: 'Import Statement', icon: FileSpreadsheet, badge: 'New' },
        { id: 'upload', label: 'Upload Receipt', icon: Upload },
        { id: 'reports', label: 'Reports & Export', icon: Download }
      ]
    },
    {
      group: 'Cloud & Database',
      items: [
        { id: 'sync', label: 'Cloud Sync', icon: RefreshCw, status: isConnected },
        { id: 'database', label: 'Database & SQL', icon: Database }
      ]
    },
    {
      group: 'Administration',
      items: [
        { id: 'users', label: 'Users & Access', icon: Users },
        { id: 'settings', label: 'Security & Settings', icon: Settings }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-0' : 'w-72'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} shadow-2xl lg:shadow-none select-none`}
      >
        {/* Top Header / Brand Logo */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
          <PayLensLogo className="h-8 w-auto max-w-[155px]" showText={true} />

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/60 shadow-2xs">
              1.49
            </span>

            {/* Collapse / Close Button on Desktop & Mobile */}
            <button
              onClick={() => {
                if (onToggleCollapse) onToggleCollapse();
                if (onClose) onClose();
              }}
              title="Close / Collapse Sidebar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navItems.map((section, sIdx) => (
            <div key={sIdx}>
              {section.group && (
                <p className="px-3 mb-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.group}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                          if (onClose) onClose();
                        } else {
                          handleNavClick(item.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>

                      {/* Badge / Count */}
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider">
                          {item.badge}
                        </span>
                      )}

                      {item.count !== undefined && item.count > 0 && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      )}

                      {/* Shortcut */}
                      {item.shortcut && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                          {item.shortcut}
                        </span>
                      )}

                      {/* Status indicator */}
                      {item.status !== undefined && (
                        <span className={`w-2 h-2 rounded-full ${item.status ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* BOTTOM USER PROFILE CARD */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 relative">
          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-1 z-30 animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  handleNavClick('settings');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Settings className="w-4 h-4 text-blue-500" />
                Account Settings
              </button>

              <button
                onClick={onToggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </span>
                <span className="text-[10px] text-slate-400">Toggle</span>
              </button>

              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          )}

          {/* User Card trigger */}
          <div
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center justify-between p-2 rounded-2xl bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 cursor-pointer shadow-sm transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* User Avatar Circle */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-indigo-600 p-0.5 shrink-0 shadow-sm overflow-hidden flex items-center justify-center text-white font-bold text-sm">
                <span className="uppercase">{displayName.charAt(0)}</span>
              </div>

              {/* Name & Role */}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 capitalize">
                  {role}
                </p>
              </div>
            </div>

            {/* Caret icon */}
            <div className="text-slate-400 p-1">
              {isProfileMenuOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
