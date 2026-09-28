import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Search,
  Sparkles,
  RefreshCw,
  Check,
  X,
  FileUp,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronRight,
  Info,
  Calendar,
  Lock,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { parseStatementFile } from '../services/statementParserService';

export default function ImportStatementPage({
  existingTransactions = [],
  onImportSuccess,
  onNavigateToTab
}) {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  // PDF Password Protection State
  const [pdfPasswordModalOpen, setPdfPasswordModalOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfPasswordError, setPdfPasswordError] = useState('');
  const [pendingPdfFile, setPendingPdfFile] = useState(null);
  const [showPdfPassword, setShowPdfPassword] = useState(false);

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, Received, Sent, NEW, DUP
  const [appFilter, setAppFilter] = useState('ALL');

  const fileInputRef = useRef(null);

  // Parse uploaded file
  const handleFileProcess = async (selectedFile, password = '') => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsParsing(true);
    setParseError(null);
    setImportSummary(null);

    try {
      const records = await parseStatementFile(selectedFile, existingTransactions, password);
      if (!records || records.length === 0) {
        throw new Error('No valid financial transactions were detected in this file.');
      }
      setParsedTransactions(records);
      setPdfPasswordModalOpen(false);
      setPdfPassword('');
      setPdfPasswordError('');
      setPendingPdfFile(null);
    } catch (err) {
      console.error('File parsing failed:', err);
      if (err.isPasswordRequired) {
        setPendingPdfFile(selectedFile);
        setPdfPasswordModalOpen(true);
        if (err.isPasswordIncorrect) {
          setPdfPasswordError('Incorrect password. Please verify and try again.');
        } else {
          setPdfPasswordError('');
        }
      } else {
        setParseError(err.message || 'Failed to parse file. Please check file format.');
        setParsedTransactions([]);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleUnlockPdf = (e) => {
    e?.preventDefault();
    if (!pdfPassword.trim()) {
      setPdfPasswordError('Please enter the statement password.');
      return;
    }
    if (pendingPdfFile) {
      handleFileProcess(pendingPdfFile, pdfPassword.trim());
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Quick load sample statement with 10 standard columns
  const handleLoadSampleStatement = () => {
    const today = new Date();
    const formatDate = (daysAgo) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const sampleCSV = `Date,Time,Transaction Details,Other Transaction Details (UPI ID or A/c No),Your Account,Amount,UPI Ref No.,Order ID,Remarks,Tags
${formatDate(0)},04:30 PM,RAMESH TRADERS,ramesh@okhdfcbank,SBI - 4321,14500.00,524810291882,T240928163012,Payment for Goods,Vendor Payment
${formatDate(1)},01:15 PM,AMAZON SELLER,amazon@apl,HDFC - 8810,3290.00,524790123991,T240928131500,Office Supplies,Expense
${formatDate(2)},11:45 AM,VERMA ELECTRONICS,verma@paytm,SBI - 4321,28400.00,524680992014,T240927114521,Invoice #441,Client Payment
${formatDate(3)},06:20 PM,BESCOM ELECTRICITY,bescom@icici,HDFC - 8810,1840.00,524578129033,T240926182044,Electricity Bill,Utilities
${formatDate(4)},02:10 PM,SHIVAM ENTERPRISES,shivam@ybl,SBI - 4321,9600.00,524419827461,T240925141019,Settlement,Business
${formatDate(5)},10:05 AM,MOHAN CONTRACTOR,mohan@okaxis,HDFC - 8810,50000.00,524219902188,T240924100533,Project Advance,Advance`;

    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const sampleFile = new File([blob], 'PhonePe_UPI_Statement_Sample.csv', { type: 'text/csv' });
    handleFileProcess(sampleFile);
  };

  // Toggle selection for a single row
  const toggleRowSelect = (id) => {
    setParsedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  // Bulk selection controls
  const handleSelectAll = (selectState) => {
    setParsedTransactions((prev) =>
      prev.map((t) => ({ ...t, selected: selectState }))
    );
  };

  const handleSelectNewOnly = () => {
    setParsedTransactions((prev) =>
      prev.map((t) => ({ ...t, selected: !t.isDuplicate }))
    );
  };

  // Analytics & Summary calculations
  const analytics = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    let inflowCount = 0;
    let outflowCount = 0;
    let duplicateCount = 0;
    let selectedCount = 0;
    let selectedAmount = 0;
    const appBreakdown = {};

    parsedTransactions.forEach((t) => {
      const amt = t.rawAmount || 0;
      if (t.type === 'Received') {
        totalInflow += amt;
        inflowCount++;
      } else {
        totalOutflow += amt;
        outflowCount++;
      }

      if (t.isDuplicate) duplicateCount++;

      if (t.selected) {
        selectedCount++;
        selectedAmount += t.type === 'Received' ? amt : -amt;
      }

      const app = t.appName || 'Other';
      appBreakdown[app] = (appBreakdown[app] || 0) + 1;
    });

    return {
      totalRecords: parsedTransactions.length,
      totalInflow,
      inflowCount,
      totalOutflow,
      outflowCount,
      netBalance: totalInflow - totalOutflow,
      duplicateCount,
      newCount: parsedTransactions.length - duplicateCount,
      selectedCount,
      selectedAmount,
      appBreakdown
    };
  }, [parsedTransactions]);

  // Distinct apps in parsed list
  const distinctApps = useMemo(() => {
    return Array.from(new Set(parsedTransactions.map((t) => t.appName).filter(Boolean)));
  }, [parsedTransactions]);

  // Filtered rows for interactive review table
  const filteredRows = useMemo(() => {
    return parsedTransactions.filter((t) => {
      if (typeFilter === 'Received' && t.type !== 'Received') return false;
      if (typeFilter === 'Sent' && t.type !== 'Sent') return false;
      if (typeFilter === 'NEW' && t.isDuplicate) return false;
      if (typeFilter === 'DUP' && !t.isDuplicate) return false;

      if (appFilter !== 'ALL' && t.appName !== appFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchFrom = (t.from || '').toLowerCase().includes(query);
        const matchTo = (t.to || '').toLowerCase().includes(query);
        const matchUtr = (t.transactionId || '').toLowerCase().includes(query);
        const matchApp = (t.appName || '').toLowerCase().includes(query);
        if (!matchFrom && !matchTo && !matchUtr && !matchApp) return false;
      }

      return true;
    });
  }, [parsedTransactions, typeFilter, appFilter, searchQuery]);

  // Batch commit to database
  const handleCommitImport = async () => {
    const toImport = parsedTransactions.filter((t) => t.selected);
    if (toImport.length === 0) {
      alert('Please select at least one transaction to import.');
      return;
    }

    setIsImporting(true);
    try {
      // Clean and prepare records preserving all 10 standard columns
      const cleanRecords = toImport.map((t) => ({
        date: t.date || '-',
        time: t.time || '-',
        transactionDetails: t.transactionDetails || t.from || t.to || '-',
        otherDetails: t.otherDetails || '-',
        yourAccount: t.yourAccount || '-',
        amount: t.amount,
        rawAmount: t.rawAmount,
        upiRefNo: t.upiRefNo || t.transactionId || '-',
        orderId: t.orderId || '-',
        remarks: t.remarks || '-',
        tags: t.tags || 'General',
        // Legacy / core fields
        appName: t.appName,
        type: t.type,
        from: t.from,
        to: t.to,
        dateTime: t.dateTime,
        transactionId: t.transactionId,
        screenshotUrl: null,
        timestamp: t.timestamp || new Date().toISOString(),
        synced: false
      }));

      await onImportSuccess(cleanRecords);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setImportSummary({
        importedCount: cleanRecords.length,
        inflow: analytics.totalInflow,
        outflow: analytics.totalOutflow
      });
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + (err.message || err));
    } finally {
      setIsImporting(false);
    }
  };

  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Statement Ingestion &amp; Analytics Studio
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Universal Multi-Format
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Import Bank Statements (PDF), Excel spreadsheets (.xlsx), CSV files, or UPI exports with real-time analytics
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSampleStatement}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Load Sample Statement</span>
          </button>
        </div>
      </div>

      {/* IMPORT SUCCESS CELEBRATION CARD */}
      {importSummary && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 rounded-3xl p-6 shadow-lg backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Successfully Ingested {importSummary.importedCount} Transactions!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Records have been committed to your Ledger and synced across all devices and dashboards.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab?.('ledger')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Open Ledger
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('dashboard')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                View Power BI Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportSummary(null);
                  setParsedTransactions([]);
                  setFile(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAG AND DROP ZONE */}
      {parsedTransactions.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/30 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.json,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-inner">
              {isParsing ? (
                <RefreshCw className="w-8 h-8 animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {isParsing ? 'Parsing & Analyzing Statement...' : 'Drop your Statement or Spreadsheet here'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Upload Bank Statement PDFs, UPI Passbooks, or accounting spreadsheets. PayLens automatically detects dates, parties, UTRs, and debits/credits.
            </p>

            <button
              type="button"
              disabled={isParsing}
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Browse File on Computer</span>
            </button>

            {/* Supported Formats Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Supported:</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-mono font-semibold border border-emerald-200 dark:border-emerald-800">
                .XLSX / .XLS (Excel)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-mono font-semibold border border-blue-200 dark:border-blue-800">
                .CSV (Comma Separated)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-mono font-semibold border border-rose-200 dark:border-rose-800">
                .PDF (Bank Statement)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-mono font-semibold border border-amber-200 dark:border-amber-800">
                .JSON (Raw Data)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PARSE ERROR ALERT */}
      {parseError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="font-bold text-rose-800 dark:text-rose-200">Parsing Notice:</strong>
            <p className="text-rose-700 dark:text-rose-300 mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {/* ANALYTICS STUDIO & PREVIEW WHEN STATEMENT IS LOADED */}
      {parsedTransactions.length > 0 && (
        <div className="space-y-6">
          {/* File Meta Banner */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {file?.name || 'Imported_Statement'}
                </span>
                <span className="text-slate-500 ml-2">
                  ({(file?.size ? (file.size / 1024).toFixed(1) + ' KB' : 'Standard File')})
                </span>
                <div className="text-slate-400 mt-0.5">
                  Detected {analytics.totalRecords} records • {analytics.newCount} new • {analytics.duplicateCount} existing
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setParsedTransactions([]);
                  setFile(null);
                }}
                className="px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition cursor-pointer"
              >
                Change File
              </button>
            </div>
          </div>

          {/* 4 EXECUTIVE KPI ANALYTICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Inflow */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Inflow (Received)
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatINR(analytics.totalInflow)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {analytics.inflowCount} incoming transactions
              </div>
            </div>

            {/* Total Outflow */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Outflow (Sent)
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {formatINR(analytics.totalOutflow)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {analytics.outflowCount} outgoing payments
              </div>
            </div>

            {/* Net Settlement */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Net Statement Balance
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-2xl font-black ${
                  analytics.netBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatINR(analytics.netBalance)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <span>{analytics.netBalance >= 0 ? 'Surplus Inflow' : 'Net Expenditure'}</span>
              </div>
            </div>

            {/* Duplicate Shield */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Duplicate Shield
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {analytics.duplicateCount} DUP
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {analytics.duplicateCount > 0
                  ? 'Auto-unselected to prevent double counting'
                  : 'All records are 100% unique!'}
              </div>
            </div>
          </div>

          {/* APP BREAKDOWN CHIPS */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-2">
              <Layers className="w-3.5 h-3.5 text-indigo-500" /> Channel Breakdown:
            </span>
            {Object.entries(analytics.appBreakdown).map(([app, count]) => (
              <span
                key={app}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/60 dark:border-slate-700 flex items-center gap-1.5"
              >
                <span className="font-bold">{app}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                  {count}
                </span>
              </span>
            ))}
          </div>

          {/* INTERACTIVE TABLE CONTROLS */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Quick Type Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: `All (${parsedTransactions.length})` },
                  { id: 'Received', label: `Inflow (${analytics.inflowCount})` },
                  { id: 'Sent', label: `Outflow (${analytics.outflowCount})` },
                  { id: 'NEW', label: `New Only (${analytics.newCount})` },
                  { id: 'DUP', label: `Duplicates (${analytics.duplicateCount})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      typeFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Right: Search & Bulk Selection */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search party, UTR, app..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleSelectNewOnly}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                >
                  Select New Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* PARSED TABLE WITH 10 STANDARD FIELDS */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredRows.length > 0 &&
                          filteredRows.every((r) => r.selected)
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setParsedTransactions((prev) =>
                            prev.map((t) =>
                              filteredRows.some((fr) => fr.id === t.id)
                                ? { ...t, selected: checked }
                                : t
                            )
                          );
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Transaction Details</th>
                    <th className="p-3">Other Details (UPI ID / A/c)</th>
                    <th className="p-3">Your Account</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">UPI Ref No.</th>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Remarks</th>
                    <th className="p-3">Tags</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredRows.map((tx) => {
                    const isReceived = tx.type === 'Received';
                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                          tx.selected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!tx.selected}
                            onChange={() => toggleRowSelect(tx.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        {/* 1. Date */}
                        <td className="p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                          {tx.date || (tx.dateTime ? tx.dateTime.split(/[\s,]+/)[0] : '-')}
                        </td>
                        {/* 2. Time */}
                        <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {tx.time || '-'}
                        </td>
                        {/* 3. Transaction Details */}
                        <td className="p-3 max-w-[220px] truncate text-slate-800 dark:text-slate-200 font-semibold" title={tx.transactionDetails}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isReceived ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className="truncate">{tx.transactionDetails || (isReceived ? tx.from : tx.to) || '-'}</span>
                          </div>
                        </td>
                        {/* 4. Other Transaction Details (UPI ID or A/c No) */}
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={tx.otherDetails}>
                          {tx.otherDetails && tx.otherDetails !== '-' ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-indigo-600 dark:text-indigo-400">
                              {tx.otherDetails}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        {/* 5. Your Account */}
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {tx.yourAccount && tx.yourAccount !== '-' ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium">
                              {tx.yourAccount}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        {/* 6. Amount */}
                        <td
                          className={`p-3 text-right font-black ${
                            isReceived
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isReceived ? '+' : '-'} {tx.amount}
                        </td>
                        {/* 7. UPI Ref No. */}
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {tx.upiRefNo && tx.upiRefNo !== '-' ? tx.upiRefNo : (tx.transactionId || '-')}
                        </td>
                        {/* 8. Order ID */}
                        <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {tx.orderId && tx.orderId !== '-' ? tx.orderId : '-'}
                        </td>
                        {/* 9. Remarks */}
                        <td className="p-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate" title={tx.remarks}>
                          {tx.remarks && tx.remarks !== '-' ? tx.remarks : '-'}
                        </td>
                        {/* 10. Tags */}
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isReceived
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                            {tx.tags || (isReceived ? 'Inflow' : 'Outflow')}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="p-3 text-center">
                          {tx.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                              Duplicate
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400 text-xs">
                        No transactions match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* STICKY COMMIT BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 text-white shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  {analytics.selectedCount}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">
                    {analytics.selectedCount} of {analytics.totalRecords} Records Selected
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Net Selected Impact: {formatINR(analytics.selectedAmount)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={analytics.selectedCount === 0 || isImporting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-500/30 transition flex items-center gap-2 cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ingesting into Database...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>
                        Import {analytics.selectedCount} Transactions to Ledger
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD PROTECTED PDF UNLOCK MODAL */}
      {pdfPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Password Protected Statement
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                  {pendingPdfFile?.name || 'Bank statement PDF'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              This statement PDF is password encrypted by the bank. Enter your statement password (typically DOB, PAN, or Mobile digits) to decrypt and import:
            </p>

            <form onSubmit={handleUnlockPdf} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Statement Password
                </label>
                <div className="relative">
                  <input
                    type={showPdfPassword ? 'text' : 'password'}
                    value={pdfPassword}
                    onChange={(e) => {
                      setPdfPassword(e.target.value);
                      setPdfPasswordError('');
                    }}
                    autoFocus
                    placeholder="Enter PDF password..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPdfPassword(!showPdfPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPdfPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {pdfPasswordError && (
                  <p className="text-[11px] text-rose-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{pdfPasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPdfPasswordModalOpen(false);
                    setPendingPdfFile(null);
                    setPdfPassword('');
                    setPdfPasswordError('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isParsing || !pdfPassword.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Unlocking...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Unlock &amp; Import</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
