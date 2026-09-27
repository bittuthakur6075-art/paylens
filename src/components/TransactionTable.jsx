import React, { useState, useMemo } from 'react';
import { 
  Search, Download, Filter, Eye, Copy, Check, 
  Trash2, RefreshCw, ExternalLink, ArrowUpRight, 
  ArrowDownLeft, AlertCircle, Sparkles, Smartphone
} from 'lucide-react';

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

export default function TransactionTable({ 
  transactions = [], 
  onViewImage, 
  onDeleteTransaction, 
  onClearAll,
  isSyncing = false,
  onSync,
  needsScriptUpdate = false,
  onOpenBackendModal
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);

  // Extract distinct apps for the filter dropdown
  const distinctApps = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.appName) set.add(t.appName);
    });
    return Array.from(set);
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // App Filter
      if (selectedApp !== 'ALL' && t.appName !== selectedApp) {
        return false;
      }
      // Type Filter
      if (selectedType !== 'ALL' && t.type !== selectedType) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const fromMatch = (t.from || '').toLowerCase().includes(query);
        const toMatch = (t.to || '').toLowerCase().includes(query);
        const utrMatch = (t.transactionId || '').toLowerCase().includes(query);
        const appMatch = (t.appName || '').toLowerCase().includes(query);
        const amtMatch = (t.amount || '').toLowerCase().includes(query);
        if (!fromMatch && !toMatch && !utrMatch && !appMatch && !amtMatch) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedApp, selectedType, searchTerm]);

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

  // Export filtered transactions to CSV
  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['Timestamp', 'Payment App', 'Type', 'From', 'To', 'Amount', 'Date & Time', 'Transaction ID / UTR'];
    const rows = filteredTransactions.map(t => [
      `"${t.timestamp || new Date().toISOString()}"`,
      `"${t.appName || ''}"`,
      `"${t.type || ''}"`,
      `"${t.from || ''}"`,
      `"${t.to || ''}"`,
      `"${t.amount || ''}"`,
      `"${t.dateTime || ''}"`,
      `"${t.transactionId || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PayLens_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <button
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Export to CSV
            </button>
            {transactions.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
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
              <option value="ALL">All Payment Apps</option>
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
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[11px]">
              <tr>
                <th className="py-3.5 px-4">App</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">From</th>
                <th className="py-3.5 px-4">To</th>
                <th className="py-3.5 px-4">Date &amp; Time</th>
                <th className="py-3.5 px-4">Transaction ID / UTR</th>
                <th className="py-3.5 px-4 text-center">Receipt</th>
                <th className="py-3.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredTransactions.map((tx) => {
                const isSent = tx.type === 'Sent';
                const hasImage = !!tx.screenshotUrl;

                return (
                  <tr 
                    key={tx.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                  >
                    {/* App */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <AppBadge appName={tx.appName} />
                    </td>

                    {/* Type Badge */}
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

                    {/* Amount */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight">
                        {tx.amount}
                      </span>
                    </td>

                    {/* From */}
                    <td className="py-3 px-4 max-w-[140px] truncate" title={tx.from}>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {tx.from || '—'}
                      </span>
                    </td>

                    {/* To */}
                    <td className="py-3 px-4 max-w-[150px] truncate" title={tx.to}>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {tx.to || '—'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {tx.dateTime}
                    </td>

                    {/* UTR / Transaction ID */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-indigo-600 dark:text-sky-400 font-bold select-all">
                          {tx.transactionId || 'N/A'}
                        </span>
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
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="Delete entry"
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
