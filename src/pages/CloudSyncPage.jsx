import React, { useState } from 'react';
import { 
  Cloud, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, 
  Copy, Check, Database, Sparkles, Send, ShieldCheck
} from 'lucide-react';
import { getWebhookUrl, setWebhookUrl, testWebhookConnection } from '../services/sheetsService';
import { isSupabaseConfigured } from '../services/supabaseService';

const APPS_SCRIPT_CODE = `/**
 * PayLens - Complete Multi-Device Google Apps Script Backend
 * Enables full read/write synchronization across all devices and phones.
 * Paste this into: Extensions > Apps Script in your Google Sheet
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getTransactions";

  if (action === "getTransactions") {
    return getTransactions();
  } else if (action === "getAuth") {
    return getAuth();
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "PayLens API active" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "append";

    if (action === "append") {
      return appendTransaction(data);
    } else if (action === "delete") {
      return deleteTransaction(data);
    } else if (action === "clearAll") {
      return clearAllTransactions();
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export default function CloudSyncPage({ 
  webhookUrl: currentWebhookUrl,
  onWebhookUpdated,
  isSyncing,
  onSync,
  lastSyncTime,
  transactionsCount = 0
}) {
  const [urlInput, setUrlInput] = useState(currentWebhookUrl || getWebhookUrl() || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isSupabaseActive = isSupabaseConfigured();
  const isSheetsActive = Boolean(currentWebhookUrl || urlInput);

  const handleSaveUrl = () => {
    setWebhookUrl(urlInput.trim());
    if (onWebhookUpdated) onWebhookUpdated(urlInput.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    if (!urlInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testWebhookConnection(urlInput.trim());
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, message: e.message || 'Connection failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyScript = async () => {
    await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Cloud &amp; Multi-Device Sync Center
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sync transaction ledgers between Google Sheets, Supabase PostgreSQL, and your devices
            </p>
          </div>
        </div>

        <button
          onClick={onSync}
          disabled={isSyncing}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-600/20 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing Cloud...' : 'Force Sync Now'}</span>
        </button>
      </div>

      {/* Connection Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Supabase PostgreSQL Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                Supabase PostgreSQL Cloud
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isSupabaseActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
              }`}>
                {isSupabaseActive ? '● Real-time Active' : 'Not Configured'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              Provides millisecond response times, real-time WebSocket ledger broadcasting across all phones and PCs, and storage for receipts.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Primary cloud store</span>
            <span className="font-semibold text-slate-600 dark:text-slate-200">{transactionsCount} synced records</span>
          </div>
        </div>

        {/* Google Sheets Webhook Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" />
                Google Sheets Webhook
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isSheetsActive
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {isSheetsActive ? '● Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              Backs up every parsed transaction directly into your private Google Sheet spreadsheet automatically.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Last Sync</span>
            <span className="font-semibold text-slate-600 dark:text-slate-200">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Google Sheets Webhook Configuration */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          Google Apps Script Webhook URL
        </h3>
        <p className="text-xs text-slate-500">
          Enter your deployed Google Apps Script Web App URL below to automatically sync receipts with your spreadsheet.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSaveUrl}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 transition"
          >
            {saveSuccess ? 'Saved!' : 'Save URL'}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !urlInput}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shrink-0 transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-blue-500" />
            <span>{isTesting ? 'Testing...' : 'Test Ping'}</span>
          </button>
        </div>

        {testResult && (
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
            testResult.success 
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Apps Script Code Reference */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Google Apps Script Code
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy and paste this script into your Google Sheet: <em>Extensions &gt; Apps Script</em>
            </p>
          </div>
          <button
            onClick={handleCopyScript}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied!' : 'Copy Script'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-2xl bg-slate-950 text-slate-300 text-xs font-mono overflow-x-auto max-h-60 border border-slate-800">
          {APPS_SCRIPT_CODE}
        </pre>
      </div>
    </div>
  );
}
