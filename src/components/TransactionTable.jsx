import React, { useState, useMemo } from 'react';
import { 
  Search, Download, Eye, Copy, Check, 
  Trash2, RefreshCw, ArrowUpRight, 
  ArrowDownLeft, AlertCircle, Sparkles,
  ArrowUpDown, ChevronUp, ChevronDown, AlertTriangle, X,
  FileSpreadsheet
} from 'lucide-react';
import { exportToProExcel, exportToCleanCSV } from '../services/exportService';

// Helper for stylized app badge
const AppBadge = ({ appName }) => {
  const name = appName || 'Unknown';
  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
  let dotColor = 'bg-slate-400';

  if (name.includes('PhonePe')) {
    badgeStyle = 'bg-purple-950/70 text-purple-300 border-purple-800/80';
    dotColor = 'bg-purple-400';
  } else if (name.includes('Google') || name.includes('GPay')) {
    badgeStyle = 'bg-blue-950/70 text-blue-300 border-blue-800/80';
    dotColor = 'bg-blue-400';
  } else if (name.includes('Paytm')) {
    badgeStyle = 'bg-sky-950/70 text-sky-300 border-sky-800/80';
    dotColor = 'bg-sky-400';
  } else if (name.includes('CRED')) {
    badgeStyle = 'bg-rose-950/70 text-rose-300 border-rose-800/80';
    dotColor = 'bg-rose-400';
  } else if (name.includes('BHIM')) {
    badgeStyle = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80';
    dotColor = 'bg-emerald-400';
  } else if (name.includes('Amazon')) {
    badgeStyle = 'bg-amber-950/70 text-amber-300 border-amber-800/80';
    dotColor = 'bg-amber-400';
  } else if (name.includes('Bank')) {
    badgeStyle = 'bg-indigo-950/70 text-indigo-300 border-indigo-800/80';
    dotColor = 'bg-indigo-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeStyle}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {name}
    </span>
  );
};

const parseAmountNumber = (amtStr) => {
  if (typeof amtStr === 'number') return amtStr;
  if (!amtStr) return 0;
  const cleaned = amtStr.toString().replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

export default function TransactionTable({ 
  transactions = [], 
  onViewImage, 
  onDeleteTransaction, 
  onClearAll,
  isSyncing = false,
  onSync,
  needsScriptUpdate = false,
  onOpenBackendModal,
  onOpenImport,
  userRole = 'admin'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [amountRange, setAmountRange] = useState('ALL');
  const [sortField, setSortField] = useState('timestamp'); // 'amount', 'dateTime', 'appName', 'from', 'to'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [copiedId, setCopiedId] = useState(null);

  // Extract distinct apps for the filter dropdown
  const distinctApps = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.appName) set.add(t.appName);
    });
    return Array.from(set);
  }, [transactions]);

  // Compute duplicate UTR counts
  const duplicateUtrMap = useMemo(() => {
    const counts = {};
    transactions.forEach(t => {
      const utr = t.transactionId?.trim();
      if (utr && utr !== 'N/A' && utr.length > 5) {
        counts[utr] = (counts[utr] || 0) + 1;
      }
    });
    return counts;
  }, [transactions]);

  // Handle header sort click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter & Sort transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // App Filter
        if (selectedApp !== 'ALL' && t.appName !== selectedApp) {
          return false;
        }
        // Type Filter
        if (selectedType !== 'ALL' && t.type !== selectedType) {
          return false;
        }
        // Amount Range Filter
        const amt = parseAmountNumber(t.amount);
        if (amountRange === 'MICRO' && amt >= 500) return false;
        if (amountRange === 'MID' && (amt < 500 || amt > 2000)) return false;
        if (amountRange === 'HIGH' && (amt <= 2000 || amt > 10000)) return false;
        if (amountRange === 'WHALE' && amt <= 10000) return false;

        // Search term
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const fromMatch = (t.from || '').toLowerCase().includes(query);
          const toMatch = (t.to || '').toLowerCase().includes(query);
          const utrMatch = (t.transactionId || '').toLowerCase().includes(query);
          const appMatch = (t.appName || '').toLowerCase().includes(query);
          const amtMatch = (t.amount || '').toLowerCase().includes(query);
          const dateMatch = (t.dateTime || '').toLowerCase().includes(query);
          if (!fromMatch && !toMatch && !utrMatch && !appMatch && !amtMatch && !dateMatch) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'amount') {
          valA = parseAmountNumber(a.amount);
          valB = parseAmountNumber(b.amount);
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        if (sortField === 'timestamp' || sortField === 'dateTime') {
          const dateA = new Date(a.dateTime || a.timestamp || 0).getTime() || 0;
          const dateB = new Date(b.dateTime || b.timestamp || 0).getTime() || 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }

        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, selectedApp, selectedType, amountRange, searchTerm, sortField, sortDirection]);

  // Copy UTR to clipboard
  const handleCopyUtr = async (utr, id) => {
    if (!utr || utr === 'N/A') return;
    await navigator.clipboard.writeText(utr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Direct 1-click image download
  const handleDirectDownload = async (tx) => {
    const src = tx.screenshotUrl || tx.cloudImageUrl;
    if (!src) return;
    try {
      let blob;
      if (src.startsWith('data:')) {
        const parts = src.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bin = atob(parts[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        const response = await fetch(src);
        blob = await response.blob();
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = `receipt-${tx.appName || 'payment'}-${tx.transactionId || Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      window.open(src, '_blank');
    }
  };

  // State for export menu & progress
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Export filtered transactions to Pro Colored Excel (.xlsx)
  const handleExportProExcel = async () => {
    if (filteredTransactions.length === 0) return;
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      await exportToProExcel(filteredTransactions, {
        title: 'PAYLENS TRANSACTIONS & AUDIT LEDGER',
        subtitle: `Exported: ${filteredTransactions.length} records | Search: "${searchTerm || 'None'}" | Filter: ${selectedType}`,
        filename: `PayLens_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`
      });
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel: ' + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  // Export filtered transactions to CSV
  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) return;
    setShowExportMenu(false);
    exportToCleanCSV(
      filteredTransactions,
      `PayLens_Transactions_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl backdrop-blur-xl shadow-lg dark:shadow-xl overflow-hidden flex flex-col transition-colors">
      {/* Table Header Controls */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Parsed Transactions Ledger
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold">
                {filteredTransactions.length} records
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Synced with local storage and Google Sheets database
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onSync && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                title="Refresh and sync transactions from Google Sheets"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
              </button>
            )}
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                title="Import statement files (PDF, Excel, CSV, JSON)"
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition border border-indigo-200 dark:border-indigo-800 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Import Statement</span>
              </button>
            )}

            {/* Pro Export Controls (Excel + CSV) */}
            <div className="relative">
              <div className="inline-flex rounded-xl shadow-sm border border-emerald-600/30">
                <button
                  onClick={handleExportProExcel}
                  disabled={filteredTransactions.length === 0 || isExporting}
                  title="Export colored executive Excel report"
                  className="px-3.5 py-2 rounded-l-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isExporting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                  )}
                  <span>Export Excel</span>
                  <span className="text-[10px] bg-emerald-800/80 px-1 py-0.2 rounded font-bold uppercase tracking-wider text-emerald-200">
                    PRO
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={filteredTransactions.length === 0 || isExporting}
                  title="Choose export format (Excel or CSV)"
                  className="px-2 py-2 rounded-r-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs transition border-l border-emerald-500/40 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={handleExportProExcel}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-start gap-2.5 transition group cursor-pointer"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Pro Excel (.xlsx)</span>
                          <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-1 rounded">PRO</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          Executive report with colors, KPI boxes &amp; green/red badges
                        </p>
                      </div>
                    </button>

                    <div className="border-t border-slate-100 dark:border-slate-700/80 my-1" />

                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-start gap-2.5 transition cursor-pointer"
                    >
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mt-0.5">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Standard CSV (.csv)
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Clean comma-separated spreadsheet
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            {transactions.length > 0 && userRole === 'admin' && (
              <button
                onClick={onClearAll}
                title="Clear all transactions from cloud database"
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Multi-device sync notice if script needs update */}
        {needsScriptUpdate && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                To view data on other systems/mobiles, your Google Apps Script needs the <b>doGet</b> update.
              </span>
            </div>
            {onOpenBackendModal && (
              <button
                onClick={onOpenBackendModal}
                className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0 transition text-[11px] flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-amber-200" />
                Update Script (1 Min)
              </button>
            )}
          </div>
        )}

        {/* Quick Amount Slicers Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Amount Range:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'MICRO', label: '< ₹500' },
            { id: 'MID', label: '₹500 - ₹2,000' },
            { id: 'HIGH', label: '₹2,000 - ₹10,000' },
            { id: 'WHALE', label: '> ₹10,000' }
          ].map((tier) => (
            <button
              key={tier.id}
              onClick={() => setAmountRange(tier.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                amountRange === tier.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tier.label}
            </button>
          ))}
          {amountRange !== 'ALL' && (
            <button
              onClick={() => setAmountRange('ALL')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sender, receiver, UTR..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* App Filter */}
          <div>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Payment Apps ({distinctApps.length})</option>
              {distinctApps.map(app => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800">
            {['ALL', 'Sent', 'Received'].map((typeOption) => (
              <button
                key={typeOption}
                type="button"
                onClick={() => setSelectedType(typeOption)}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedType === typeOption
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {typeOption === 'ALL' ? 'All Types' : typeOption}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[300px]">
        {filteredTransactions.length > 0 ? (
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[11px] select-none">
              <tr>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition group"
                  onClick={() => handleSort('appName')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Payment App</span>
                    {renderSortIndicator('appName')}
                  </div>
                </th>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition group"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Type</span>
                    {renderSortIndicator('type')}
                  </div>
                </th>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition group"
                  onClick={() => handleSort('from')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>From (Sender)</span>
                    {renderSortIndicator('from')}
                  </div>
                </th>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition group"
                  onClick={() => handleSort('to')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>To (Receiver)</span>
                    {renderSortIndicator('to')}
                  </div>
                </th>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition group"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Amount</span>
                    {renderSortIndicator('amount')}
                  </div>
                </th>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition group"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date &amp; Time</span>
                    {renderSortIndicator('timestamp')}
                  </div>
                </th>
                <th className="py-3.5 px-4">Transaction ID / UTR</th>
                <th className="py-3.5 px-4 text-center">Receipt Proof</th>
                <th className="py-3.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredTransactions.map((tx) => {
                const isSent = tx.type === 'Sent';
                const hasImage = !!tx.screenshotUrl;
                const isDuplicateUtr = tx.transactionId && (duplicateUtrMap[tx.transactionId] || 0) > 1;

                return (
                  <tr 
                    key={tx.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group ${
                      isDuplicateUtr ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Payment App */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <AppBadge appName={tx.appName} />
                    </td>

                    {/* Type (Sent/Received) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isSent
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                          : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                      }`}>
                        {isSent ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </td>

                    {/* From (Sender) */}
                    <td className="py-3 px-4 max-w-[160px] truncate" title={tx.from}>
                      <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {tx.from || '—'}
                      </div>
                      {tx.otherDetails && tx.otherDetails !== '-' && tx.type === 'Received' && (
                        <div className="text-[10px] text-indigo-500 font-mono truncate" title={tx.otherDetails}>
                          {tx.otherDetails}
                        </div>
                      )}
                      {tx.yourAccount && tx.yourAccount !== '-' && tx.type === 'Sent' && (
                        <div className="text-[10px] text-slate-400 font-mono truncate" title={tx.yourAccount}>
                          A/c: {tx.yourAccount}
                        </div>
                      )}
                    </td>

                    {/* To (Receiver) */}
                    <td className="py-3 px-4 max-w-[160px] truncate" title={tx.to}>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {tx.to || '—'}
                      </div>
                      {tx.otherDetails && tx.otherDetails !== '-' && tx.type === 'Sent' && (
                        <div className="text-[10px] text-indigo-500 font-mono truncate" title={tx.otherDetails}>
                          {tx.otherDetails}
                        </div>
                      )}
                      {tx.yourAccount && tx.yourAccount !== '-' && tx.type === 'Received' && (
                        <div className="text-[10px] text-slate-400 font-mono truncate" title={tx.yourAccount}>
                          A/c: {tx.yourAccount}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`font-extrabold text-sm tracking-tight ${
                        isSent ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {tx.amount}
                      </span>
                      {tx.tags && tx.tags !== 'General' && (
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          {tx.tags}
                        </div>
                      )}
                    </td>

                    {/* Date & Time */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <div>{tx.date || (tx.dateTime ? tx.dateTime.split(/[\s,]+/)[0] : (tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-IN') : '—'))}</div>
                      <div className="text-[10px] text-slate-400">{tx.time || (tx.dateTime ? (tx.dateTime.match(/\b([0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:AM|PM|am|pm)?)\b/)?.[1] || '') : '')}</div>
                    </td>

                    {/* Transaction ID / UTR + Duplicate Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-indigo-600 dark:text-sky-400 font-bold select-all">
                          {tx.upiRefNo && tx.upiRefNo !== '-' ? tx.upiRefNo : (tx.transactionId || 'N/A')}
                        </span>
                        {isDuplicateUtr && (
                          <span 
                            title={`This UTR appears ${duplicateUtrMap[tx.transactionId]} times! Potential duplicate.`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            DUP
                          </span>
                        )}
                        {tx.transactionId && tx.transactionId !== 'N/A' && (
                          <button
                            onClick={() => handleCopyUtr(tx.transactionId, tx.id)}
                            title="Copy UTR"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                          >
                            {copiedId === tx.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      {tx.orderId && tx.orderId !== '-' && (
                        <div className="text-[10px] text-slate-400 font-mono" title={`Order ID: ${tx.orderId}`}>
                          Order: {tx.orderId}
                        </div>
                      )}
                      {tx.remarks && tx.remarks !== '-' && (
                        <div className="text-[10px] text-slate-500 italic max-w-[150px] truncate" title={tx.remarks}>
                          "{tx.remarks}"
                        </div>
                      )}
                    </td>

                    {/* Screenshot Thumbnail, View & Download */}
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      {hasImage ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <div 
                            onClick={() => onViewImage(tx)}
                            className="relative w-8 h-10 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-950 cursor-pointer group/thumb shadow-sm hover:border-indigo-500 transition"
                            title="Click to view full screenshot"
                          >
                            <img
                              src={tx.screenshotUrl}
                              alt="Receipt"
                              className="w-full h-full object-cover group-hover/thumb:scale-110 transition duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition">
                              <Eye className="w-3 h-3" />
                            </div>
                          </div>
                          <button
                            onClick={() => onViewImage(tx)}
                            title="View Receipt"
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 text-[11px] font-semibold inline-flex items-center gap-1 transition"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button
                            onClick={() => handleDirectDownload(tx)}
                            title="Download Screenshot"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition border border-slate-200 dark:border-slate-700"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {userRole !== 'read' ? (
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Delete entry"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No Transactions Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {transactions.length === 0
                ? 'Upload a payment screenshot on the left or enter transaction details to log your first record.'
                : 'No records match your active search and filter criteria.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
