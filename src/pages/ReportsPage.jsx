import React, { useState, useMemo } from 'react';
import { 
  Download, FileSpreadsheet, FileText, Calendar, Filter, 
  CheckCircle2, Printer, ArrowUpRight, ArrowDownLeft, Sparkles
} from 'lucide-react';
import { exportToProExcel, exportToCleanCSV } from '../services/exportService';

const parseAmountNumber = (amtStr) => {
  if (typeof amtStr === 'number') return amtStr;
  if (!amtStr) return 0;
  const cleaned = amtStr.toString().replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

const formatCurrency = (val) => {
  return '₹' + Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function ReportsPage({ transactions = [] }) {
  const [dateFilter, setDateFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedApp, setSelectedApp] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel', 'csv', or 'json'
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Distinct apps
  const distinctApps = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.appName).filter(Boolean)));
  }, [transactions]);

  // Filtered transactions for report
  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return transactions.filter((t) => {
      if (selectedApp !== 'ALL' && t.appName !== selectedApp) return false;
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;

      const txDate = t.dateTime || t.timestamp ? new Date(t.dateTime || t.timestamp) : null;
      if (dateFilter === 'TODAY' && txDate && txDate < todayStart) return false;
      if (dateFilter === '7DAYS' && txDate) {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - 7);
        if (txDate < d) return false;
      }
      if (dateFilter === '30DAYS' && txDate) {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - 30);
        if (txDate < d) return false;
      }
      if (dateFilter === 'CUSTOM' && txDate) {
        if (startDate && txDate < new Date(startDate)) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }
      return true;
    });
  }, [transactions, selectedApp, selectedType, dateFilter, startDate, endDate]);

  // Summary statistics
  const summary = useMemo(() => {
    let sent = 0;
    let received = 0;
    filtered.forEach((t) => {
      const amt = parseAmountNumber(t.amount);
      if (t.type === 'Received') received += amt;
      else sent += amt;
    });
    return {
      sent,
      received,
      net: received - sent,
      total: sent + received,
      count: filtered.length
    };
  }, [filtered]);

  // Export Handler
  const handleExport = async () => {
    if (filtered.length === 0) return;

    try {
      setIsExporting(true);

      if (exportFormat === 'json') {
        const jsonStr = JSON.stringify(filtered, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PayLens_Statement_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'csv') {
        exportToCleanCSV(
          filtered,
          `PayLens_Statement_${new Date().toISOString().slice(0, 10)}.csv`
        );
      } else {
        // Default: Pro Styled Excel
        await exportToProExcel(filtered, {
          title: 'PAYLENS FINANCIAL & TRANSACTION STATEMENT',
          subtitle: `Scope: ${dateFilter} | App: ${selectedApp} | Type: ${selectedType}`,
          filename: `PayLens_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`
        });
      }

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export:', err);
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Reports &amp; Statement Export
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generate formatted Excel/CSV reports, financial statements, or print ledgers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition border border-slate-200 dark:border-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print View</span>
          </button>

          <button
            onClick={handleExport}
            disabled={filtered.length === 0 || isExporting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Statement Exported!</span>
              </>
            ) : isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating Pro Report...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  Download {exportFormat === 'excel' ? 'Pro Excel (.xlsx)' : (exportFormat === 'csv' ? 'CSV' : 'JSON')} ({filtered.length})
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slicers & Scope Filter Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-blue-500" />
          Report Scope &amp; Filters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Date Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="ALL">All Recorded Dates</option>
              <option value="TODAY">Today Only</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* App Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment App
            </label>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="ALL">All Payment Channels ({distinctApps.length})</option>
              {distinctApps.map(app => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>

          {/* Flow Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction Flow
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="ALL">All (Inflow &amp; Outflow)</option>
              <option value="Received">Inward Only (Credits)</option>
              <option value="Sent">Outward Only (Debits)</option>
            </select>
          </div>

          {/* Export Format */}
          <div className="md:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Export Format</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                Pro Color Support
              </span>
            </label>
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-1">
              <button
                type="button"
                onClick={() => setExportFormat('excel')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  exportFormat === 'excel'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  exportFormat === 'csv'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  exportFormat === 'json'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-slate-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <span className="text-xs text-slate-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        )}
      </div>

      {/* Statement Summary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Records in Statement</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {summary.count}
          </p>
          <span className="text-[11px] text-slate-400">Total receipts matched</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Inflow (Credits)</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(summary.received)}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
            <ArrowDownLeft className="w-3 h-3" /> Received funds
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Outflow (Debits)</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(summary.sent)}
          </p>
          <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" /> Spent &amp; transferred
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Net Balance Delta</span>
          <p className={`text-2xl font-black mt-1 ${summary.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600'}`}>
            {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net)}
          </p>
          <span className="text-[11px] text-slate-500">Inflow minus Outflow</span>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Statement Data Preview ({filtered.length} entries)
          </h4>
          <span className="text-xs text-slate-400">Ready for instant download</span>
        </div>

        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 font-bold uppercase text-[10px] text-slate-400">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">App</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">From</th>
                <th className="py-2.5 px-4">To</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">UTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.slice(0, 50).map((t, idx) => (
                <tr key={t.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap">{t.dateTime || '—'}</td>
                  <td className="py-2.5 px-4 font-semibold">{t.appName}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      t.type === 'Received' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 max-w-[120px] truncate">{t.from || '—'}</td>
                  <td className="py-2.5 px-4 max-w-[120px] truncate">{t.to || '—'}</td>
                  <td className="py-2.5 px-4 font-extrabold whitespace-nowrap">{t.amount}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">{t.transactionId || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
