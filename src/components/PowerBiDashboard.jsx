import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Calendar,
  X,
  PieChart as PieIcon,
  BarChart3,
  Sparkles,
  Download,
  Users,
  Search,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { exportToProExcel, exportToCleanCSV } from '../services/exportService';

// Color palette for apps
const APP_COLORS = {
  PhonePe: '#9333ea',
  'Google Pay': '#2563eb',
  GPay: '#2563eb',
  Paytm: '#0284c7',
  CRED: '#e11d48',
  BHIM: '#059669',
  'Amazon Pay': '#d97706',
  Bank: '#4f46e5',
  Other: '#64748b'
};

const getAppColor = (appName) => {
  if (!appName) return APP_COLORS.Other;
  for (const [key, color] of Object.entries(APP_COLORS)) {
    if (appName.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#6366f1';
};

const parseAmountNumber = (amtStr) => {
  if (typeof amtStr === 'number') return amtStr;
  if (!amtStr) return 0;
  const cleaned = amtStr.toString().replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

const formatCurrency = (val) => {
  return '₹' + Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

export default function PowerBiDashboard({
  transactions = [],
  onFilterChange,
  activeFilter,
  onResetFilters,
  onOpenSearch
}) {
  // Slicer States
  const [dateRangePreset, setDateRangePreset] = useState('ALL'); // 'ALL', 'TODAY', 'YESTERDAY', '7DAYS', '30DAYS', 'MONTH', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedApp, setSelectedApp] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedAmountTier, setSelectedAmountTier] = useState('ALL');
  const [chartView, setChartView] = useState('area'); // 'area' or 'bar'

  // Extract distinct apps
  const distinctApps = useMemo(() => {
    const set = new Set();
    transactions.forEach((t) => {
      if (t.appName) set.add(t.appName);
    });
    return Array.from(set);
  }, [transactions]);

  // Date Parsing Helper
  const parseTransactionDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  // Filter Data based on all slicers
  const filteredData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return transactions.filter((t) => {
      // 1. App Slicer
      if (selectedApp !== 'ALL' && t.appName !== selectedApp) return false;

      // 2. Type Slicer
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;

      // 3. Amount Tier Slicer
      const amt = parseAmountNumber(t.amount);
      if (selectedAmountTier === 'MICRO' && amt >= 500) return false;
      if (selectedAmountTier === 'MID' && (amt < 500 || amt > 2000)) return false;
      if (selectedAmountTier === 'HIGH' && (amt <= 2000 || amt > 10000)) return false;
      if (selectedAmountTier === 'WHALE' && amt <= 10000) return false;

      // 4. Date Range Slicer
      if (dateRangePreset !== 'ALL') {
        const txDate = parseTransactionDate(t.dateTime || t.timestamp);
        if (!txDate) return true; // If date missing, keep it or adjust

        if (dateRangePreset === 'TODAY') {
          if (txDate < todayStart) return false;
        } else if (dateRangePreset === 'YESTERDAY') {
          const yestStart = new Date(todayStart);
          yestStart.setDate(yestStart.getDate() - 1);
          if (txDate < yestStart || txDate >= todayStart) return false;
        } else if (dateRangePreset === '7DAYS') {
          const sevenDaysAgo = new Date(todayStart);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (txDate < sevenDaysAgo) return false;
        } else if (dateRangePreset === '30DAYS') {
          const thirtyDaysAgo = new Date(todayStart);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (txDate < thirtyDaysAgo) return false;
        } else if (dateRangePreset === 'MONTH') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          if (txDate < monthStart) return false;
        } else if (dateRangePreset === 'CUSTOM') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            if (txDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [
    transactions,
    selectedApp,
    selectedType,
    selectedAmountTier,
    dateRangePreset,
    customStartDate,
    customEndDate
  ]);

  // Notify parent of active filters if needed
  const hasActiveFilters =
    selectedApp !== 'ALL' ||
    selectedType !== 'ALL' ||
    selectedAmountTier !== 'ALL' ||
    dateRangePreset !== 'ALL';

  const resetAllSlicers = () => {
    setSelectedApp('ALL');
    setSelectedType('ALL');
    setSelectedAmountTier('ALL');
    setDateRangePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    if (onResetFilters) onResetFilters();
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    let sent = 0;
    let received = 0;
    let sentCount = 0;
    let receivedCount = 0;

    filteredData.forEach((t) => {
      const val = parseAmountNumber(t.amount);
      if (t.type === 'Received') {
        received += val;
        receivedCount++;
      } else {
        sent += val;
        sentCount++;
      }
    });

    const totalVolume = sent + received;
    const netCashflow = received - sent;
    const totalCount = filteredData.length;
    const avgTicket = totalCount > 0 ? totalVolume / totalCount : 0;

    return {
      sent,
      received,
      sentCount,
      receivedCount,
      totalVolume,
      netCashflow,
      totalCount,
      avgTicket
    };
  }, [filteredData]);

  // Aggregate Data for Cash Flow Timeline (Chart 1)
  const cashFlowTimeline = useMemo(() => {
    const map = new Map();

    filteredData.forEach((t) => {
      let dateKey = 'Undated';
      if (t.dateTime) {
        // e.g. "28 Sep 2026" or extract short date
        const match = t.dateTime.match(/\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?/);
        if (match) dateKey = match[0];
        else {
          const d = parseTransactionDate(t.dateTime || t.timestamp);
          if (d) {
            dateKey = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          }
        }
      } else if (t.timestamp) {
        const d = new Date(t.timestamp);
        if (!isNaN(d.getTime())) {
          dateKey = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        }
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, { date: dateKey, Inflow: 0, Outflow: 0, Total: 0 });
      }

      const item = map.get(dateKey);
      const val = parseAmountNumber(t.amount);
      if (t.type === 'Received') {
        item.Inflow += val;
      } else {
        item.Outflow += val;
      }
      item.Total += val;
    });

    return Array.from(map.values()).slice(-10); // Show last 10 date slots
  }, [filteredData]);

  // Aggregate Data for Payment App Distribution (Chart 2)
  const appDistribution = useMemo(() => {
    const map = new Map();

    filteredData.forEach((t) => {
      const app = t.appName || 'Other';
      const val = parseAmountNumber(t.amount);
      if (!map.has(app)) {
        map.set(app, { name: app, value: 0, count: 0 });
      }
      const item = map.get(app);
      item.value += val;
      item.count += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Aggregate Data for Top 5 Counterparties (Chart 3)
  const topCounterparties = useMemo(() => {
    const map = new Map();

    filteredData.forEach((t) => {
      const party = t.type === 'Received' ? t.from : t.to;
      if (!party || party === 'N/A') return;
      const cleanName = party.trim();
      const val = parseAmountNumber(t.amount);

      if (!map.has(cleanName)) {
        map.set(cleanName, { name: cleanName, amount: 0, count: 0, type: t.type });
      }
      const item = map.get(cleanName);
      item.amount += val;
      item.count += 1;
    });

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredData]);

  // Day of Week Distribution (Chart 4)
  const dayOfWeekDistribution = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = days.map((day) => ({ day, count: 0, amount: 0 }));

    filteredData.forEach((t) => {
      const d = parseTransactionDate(t.dateTime || t.timestamp);
      if (d) {
        const dayIdx = d.getDay();
        counts[dayIdx].count += 1;
        counts[dayIdx].amount += parseAmountNumber(t.amount);
      }
    });

    return counts;
  }, [filteredData]);

  // State for export menu & progress
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Export Filtered View to Pro Colored Excel (.xlsx)
  const handleExportProExcel = async () => {
    if (filteredData.length === 0) return;
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      await exportToProExcel(filteredData, {
        title: 'PAYLENS POWER BI ANALYTICS STATEMENT',
        subtitle: `Date Preset: ${dateRangePreset} | App: ${selectedApp} | Type: ${selectedType} | Amount Tier: ${selectedAmountTier}`,
        filename: `PayLens_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`
      });
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel: ' + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  // Export Filtered View to CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    setShowExportMenu(false);
    exportToCleanCSV(
      filteredData,
      `PayLens_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-5">
      {/* POWER BI SLICER CONTROL PANEL */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Quick Date Slicers */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Slicers:
            </span>

            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: '7DAYS', label: '7 Days' },
              { id: '30DAYS', label: '30 Days' },
              { id: 'MONTH', label: 'This Month' },
              { id: 'CUSTOM', label: 'Custom' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDateRangePreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  dateRangePreset === p.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}

            {dateRangePreset === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 ml-2 mt-1 sm:mt-0">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Spotlight Search Trigger */}
            <button
              onClick={onOpenSearch}
              title="Global Search (Ctrl + K)"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200/80 dark:border-slate-700 transition"
            >
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              <span>Search Data</span>
              <kbd className="hidden sm:inline px-1.5 py-0.2 bg-white dark:bg-slate-900 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-700">
                Ctrl K
              </kbd>
            </button>

            {/* Pro Export Controls (Excel + CSV) */}
            <div className="relative">
              <div className="inline-flex rounded-xl shadow-sm border border-emerald-600/30">
                <button
                  type="button"
                  onClick={handleExportProExcel}
                  disabled={filteredData.length === 0 || isExporting}
                  title="Export styled Excel analytics report with colors & KPIs"
                  className="px-3 py-1.5 rounded-l-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  {isExporting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                  )}
                  <span>Export Excel</span>
                  <span className="text-[9px] bg-emerald-800/80 px-1 py-0.2 rounded font-bold uppercase tracking-wider text-emerald-200">
                    PRO
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={filteredData.length === 0 || isExporting}
                  title="Choose export format (Excel or CSV)"
                  className="px-1.5 py-1.5 rounded-r-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs transition border-l border-emerald-500/40 cursor-pointer"
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
                        <Sparkles className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Pro Excel (.xlsx)</span>
                          <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-1 rounded">PRO</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          Full color analytics statement with KPI cards &amp; status badges
                        </p>
                      </div>
                    </button>

                    <div className="border-t border-slate-100 dark:border-slate-700/80 my-1" />

                    <button
                      type="button"
                      onClick={handleExportCSV}
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
                          Plain comma-separated values file
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Slicers (App, Type, Amount Tier) */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* App Filter Slicer */}
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Payment Apps ({distinctApps.length})</option>
              {distinctApps.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>

            {/* Direction / Type Slicer */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Flows (In & Out)</option>
              <option value="Received">Inward Only (Received)</option>
              <option value="Sent">Outward Only (Sent)</option>
            </select>

            {/* Amount Range Slicer */}
            <select
              value={selectedAmountTier}
              onChange={(e) => setSelectedAmountTier(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Amounts</option>
              <option value="MICRO">Micro (&lt; ₹500)</option>
              <option value="MID">Mid (₹500 - ₹2,000)</option>
              <option value="HIGH">High (₹2,000 - ₹10,000)</option>
              <option value="WHALE">Whale (&gt; ₹10,000)</option>
            </select>
          </div>

          {/* Active Slicers Clear */}
          {hasActiveFilters && (
            <button
              onClick={resetAllSlicers}
              className="flex items-center gap-1 text-xs text-rose-500 dark:text-rose-400 font-semibold hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Reset All Filters ({filteredData.length} of {transactions.length} records)
            </button>
          )}
        </div>
      </div>

      {/* POWER BI KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Inward / Received */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent bg-white dark:bg-slate-900/70 p-4 rounded-2xl border border-emerald-500/20 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Inward (Received)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(metrics.received)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{metrics.receivedCount} incoming receipts</span>
            <span className="text-emerald-500 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Inflow
            </span>
          </div>
        </div>

        {/* Total Outward (Sent) */}
        <div className="bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent bg-white dark:bg-slate-900/70 p-4 rounded-2xl border border-rose-500/20 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Outward (Sent)
            </span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(metrics.sent)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{metrics.sentCount} payments & bills</span>
            <span className="text-rose-500 font-bold flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" /> Outflow
            </span>
          </div>
        </div>

        {/* Total Volume / Turnover (Received + Sent Combined) */}
        <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent bg-white dark:bg-slate-900/70 p-4 rounded-2xl border border-purple-500/20 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Volume / Turnover
            </span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-500">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(metrics.totalVolume)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Received + Sent combined</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {metrics.totalCount} txns (Avg: {formatCurrency(metrics.avgTicket)})
            </span>
          </div>
        </div>
      </div>

      {/* POWER BI VISUAL CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 1: Cashflow Inflow vs Outflow Over Time (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Cashflow Dynamics (Inflow vs Outflow)
              </h4>
              <p className="text-xs text-slate-400">
                Timeline trend of money received vs paid out
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setChartView('area')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  chartView === 'area'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Area
              </button>
              <button
                onClick={() => setChartView('bar')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  chartView === 'bar'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bars
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            {cashFlowTimeline.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <BarChart3 className="w-8 h-8 opacity-30 mb-2" />
                <span>No timeline data available for this filter</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'area' ? (
                  <AreaChart
                    data={cashFlowTimeline}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val) => [formatCurrency(val), '']}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="Inflow"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorInflow)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Outflow"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorOutflow)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={cashFlowTimeline}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val) => [formatCurrency(val), '']}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: Payment App Distribution Donut (4 cols) - Click to Cross-Filter */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-purple-500" />
                App Distribution
              </h4>
              <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">
                Interactive Slices
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any app slice to cross-filter dashboard
            </p>
          </div>

          <div className="h-52 w-full my-1 relative flex items-center justify-center">
            {appDistribution.length === 0 ? (
              <div className="text-slate-400 text-xs">No app breakdown data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={appDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      cursor="pointer"
                      onClick={(entry) => {
                        setSelectedApp(selectedApp === entry.name ? 'ALL' : entry.name);
                      }}
                    >
                      {appDistribution.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={getAppColor(entry.name)}
                          stroke={selectedApp === entry.name ? '#ffffff' : 'transparent'}
                          strokeWidth={selectedApp === entry.name ? 3 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name, item) => [
                        `${formatCurrency(val)} (${item.payload.count} txns)`,
                        name
                      ]}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text in Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {selectedApp !== 'ALL' ? selectedApp : 'Apps'}
                  </span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {appDistribution.length}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* App Pills legend */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {appDistribution.slice(0, 5).map((app) => (
              <button
                key={app.name}
                onClick={() => setSelectedApp(selectedApp === app.name ? 'ALL' : app.name)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition ${
                  selectedApp === app.name
                    ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/60'
                    : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getAppColor(app.name) }}
                />
                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                  {app.name}
                </span>
                <span className="text-slate-400">
                  {metrics.totalVolume > 0
                    ? `${Math.round((app.value / metrics.totalVolume) * 100)}%`
                    : '0%'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECONDARY VISUAL ROW (Top Counterparties & Day of Week Velocity) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visual 3: Top 5 Counterparties / Payees */}
        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                Top 5 Beneficiaries / Payers
              </h4>
              <p className="text-xs text-slate-400">
                Highest payment volume parties
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">Ranked by volume</span>
          </div>

          {topCounterparties.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No party data found in current filter selection
            </div>
          ) : (
            <div className="space-y-3">
              {topCounterparties.map((p, idx) => {
                const maxVal = topCounterparties[0]?.amount || 1;
                const pct = Math.min(100, Math.round((p.amount / maxVal) * 100));
                const isReceived = p.type === 'Received';
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                        {idx + 1}. {p.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">{p.count} txns</span>
                        <span
                          className={`font-bold ${
                            isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isReceived ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Visual 4: Day of Week Transaction Velocity */}
        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-500" />
                Day of Week Activity
              </h4>
              <p className="text-xs text-slate-400">
                Transaction volume distribution Sunday through Saturday
              </p>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dayOfWeekDistribution}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(val, name, item) => [
                    `${val} transactions (${formatCurrency(item.payload.amount)})`,
                    'Activity'
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
