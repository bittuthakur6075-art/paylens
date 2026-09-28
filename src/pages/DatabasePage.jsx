import React, { useState } from 'react';
import { 
  Database, Copy, Check, ExternalLink, Sparkles, CheckCircle2, 
  AlertCircle, Table, ShieldCheck, RefreshCw 
} from 'lucide-react';
import { getSupabaseConfig, setSupabaseConfig, isSupabaseConfigured, fetchSupabaseTransactions } from '../services/supabaseService';
import { SUPABASE_SETUP_SQL } from '../components/BackendSetupModal';

export default function DatabasePage({ onDatabaseUpdated }) {
  const currentConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url || '');
  const [supabaseKey, setSupabaseKey] = useState(currentConfig.anonKey || '');
  const [copiedSql, setCopiedSql] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const isConfigured = isSupabaseConfigured();

  const handleSaveConfig = () => {
    setSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    setSavedSuccess(true);
    if (onDatabaseUpdated) onDatabaseUpdated();
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleTestDatabase = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetchSupabaseTransactions();
      setVerifyResult(res);
    } catch (e) {
      setVerifyResult({ success: false, message: e.message || 'Database connection error' });
    } finally {
      setIsVerifying(false);
    }
  };

  const columns = [
    { name: 'id', type: 'UUID', desc: 'Primary Key gen_random_uuid()' },
    { name: 'app_name', type: 'TEXT', desc: 'PhonePe, Google Pay, Paytm, etc.' },
    { name: 'type', type: 'TEXT', desc: 'Sent or Received' },
    { name: 'sender', type: 'TEXT', desc: 'Sender / Payer name' },
    { name: 'receiver', type: 'TEXT', desc: 'Receiver / Payee name' },
    { name: 'amount', type: 'TEXT', desc: 'Parsed currency string (e.g. ₹1,500)' },
    { name: 'date_time', type: 'TEXT', desc: 'Transaction timestamp from receipt' },
    { name: 'transaction_id', type: 'TEXT', desc: 'Bank UTR / UPI Ref ID' },
    { name: 'screenshot_url', type: 'TEXT', desc: 'Public Supabase Storage image URL' },
    { name: 'created_at', type: 'TIMESTAMPTZ', desc: 'Auto-generated insert timestamp' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Database &amp; SQL Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              PostgreSQL database management, schema tables, and instant migration queries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
          >
            <span>Open Supabase Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleTestDatabase}
            disabled={isVerifying || !supabaseUrl}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Checking...' : 'Verify Tables'}</span>
          </button>
        </div>
      </div>

      {verifyResult && (
        <div className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 ${
          verifyResult.success
            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
        }`}>
          {verifyResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <div>
            <p className="font-bold">{verifyResult.success ? 'Database Ready & Online' : 'Database Setup Needed'}</p>
            <p className="opacity-90">{verifyResult.message}</p>
          </div>
        </div>
      )}

      {/* Database Credentials Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          Supabase PostgreSQL Credentials
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project URL
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyzproject.supabase.co"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Anon / Public API Key
            </label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="sb_publishable_..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveConfig}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
          >
            {savedSuccess ? 'Configuration Saved!' : 'Save Database Settings'}
          </button>
        </div>
      </div>

      {/* SQL Migration Script */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              1-Click Setup SQL Script
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Run this in your <strong>Supabase SQL Editor</strong> to create tables, storage buckets, and RLS policies
            </p>
          </div>
          <button
            onClick={handleCopySql}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition self-start sm:self-auto"
          >
            {copiedSql ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSql ? 'SQL Copied!' : 'Copy Full SQL'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto max-h-72 border border-slate-800">
          {SUPABASE_SETUP_SQL}
        </pre>
      </div>

      {/* Schema Structure Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Table className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Table Schema Reference: <code>public.transactions</code>
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-[10px] text-slate-400">
              <tr>
                <th className="py-3 px-5">Column Name</th>
                <th className="py-3 px-5">Data Type</th>
                <th className="py-3 px-5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {columns.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-5 font-mono font-bold text-slate-900 dark:text-white">{c.name}</td>
                  <td className="py-2.5 px-5 font-mono text-blue-600 dark:text-blue-400">{c.type}</td>
                  <td className="py-2.5 px-5 text-slate-500 dark:text-slate-400">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
