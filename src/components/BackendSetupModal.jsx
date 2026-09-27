import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, ExternalLink, Database, 
  Key, Sparkles, AlertCircle, CheckCircle2, RefreshCw, 
  ShieldCheck, User, Lock, Eye, EyeOff, Shield, Cloud
} from 'lucide-react';
import { getWebhookUrl, setWebhookUrl, testWebhookConnection } from '../services/sheetsService';
import { getGeminiApiKey, setGeminiApiKey } from '../services/ocrService';
import { updateCredentials, getCurrentUser } from '../services/authService';
import { 
  getSupabaseConfig, 
  setSupabaseConfig, 
  fetchSupabaseTransactions 
} from '../services/supabaseService';

export const SUPABASE_SETUP_SQL = `-- 1. Create Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Unknown',
  type TEXT NOT NULL DEFAULT 'Sent',
  sender TEXT DEFAULT '',
  receiver TEXT DEFAULT '',
  amount TEXT NOT NULL DEFAULT '₹0',
  date_time TEXT DEFAULT '',
  transaction_id TEXT DEFAULT 'N/A',
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Users Table for Multi-Device Login
CREATE TABLE IF NOT EXISTS public.paylens_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert Default User (pradeep / admin)
INSERT INTO public.paylens_users (username, password_hash, full_name)
VALUES (
  'pradeep',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  'PRADEEP KUMAR SHARMA'
)
ON CONFLICT (username) DO NOTHING;

-- 4. Enable Row Level Security (RLS) & Allow Access
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access to transactions" 
  ON public.transactions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

ALTER TABLE public.paylens_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access to paylens_users" 
  ON public.paylens_users 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Enable Real-Time Updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- 6. Create Receipts Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public storage upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow public storage select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');
`;

const GOOGLE_APPS_SCRIPT_CODE = `/**
 * PayLens - Complete Multi-Device Google Apps Script Backend
 * Enables full read/write synchronization across all devices and phones.
 * Paste this into: Extensions > Apps Script in your Google Sheet
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getTransactions";

  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "PayLens Webhook connected with multi-device sync!"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "getAuth") {
    var authSheet = ss.getSheetByName("_PayLens_Auth");
    if (!authSheet) {
      authSheet = ss.insertSheet("_PayLens_Auth");
      authSheet.appendRow(["Username", "PasswordHash", "FullName", "UpdatedAt"]);
      authSheet.appendRow([
        "pradeep",
        "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
        "PRADEEP KUMAR SHARMA",
        new Date().toISOString()
      ]);
    }
    var authData = authSheet.getDataRange().getValues();
    if (authData.length > 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        user: {
          username: String(authData[1][0] || "pradeep"),
          passwordHash: String(authData[1][1] || ""),
          fullName: String(authData[1][2] || "PRADEEP KUMAR SHARMA")
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  var sheet = ss.getSheetByName("Extracted Data") || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      transactions: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var numCols = Math.max(sheet.getLastColumn(), 9);
  var range = sheet.getRange(2, 1, lastRow - 1, numCols);
  var values = range.getValues();
  var formulas = range.getFormulas();

  var transactions = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowFormula = formulas[i];
    var timestamp = row[0] ? String(row[0]) : new Date().toISOString();
    var appName = row[1] ? String(row[1]) : "Unknown";
    var type = row[2] ? String(row[2]) : "Sent";
    var from = row[3] ? String(row[3]) : "";
    var to = row[4] ? String(row[4]) : "";
    var amount = row[5] ? String(row[5]) : "₹0";
    var dateTime = row[6] ? String(row[6]) : "";
    var rawTxn = row[7] ? String(row[7]) : "";
    var transactionId = rawTxn.replace(/^'/, "");

    var screenshotCell = row[8] ? String(row[8]) : "";
    var formulaCell = (rowFormula && rowFormula[8]) ? String(rowFormula[8]) : "";
    var screenshotUrl = null;
    var hyperlinkMatch = formulaCell.match(/=HYPERLINK\\("([^"]+)"/i);
    if (hyperlinkMatch && hyperlinkMatch[1]) {
      screenshotUrl = hyperlinkMatch[1];
    } else if (screenshotCell.indexOf("http") === 0) {
      screenshotUrl = screenshotCell;
    }

    transactions.push({
      id: "tx-" + (transactionId && transactionId !== "N/A" ? transactionId : (i + "-" + Date.now())),
      timestamp: timestamp,
      appName: appName,
      type: type,
      from: from,
      to: to,
      amount: amount,
      dateTime: dateTime,
      transactionId: transactionId || "N/A",
      screenshotUrl: screenshotUrl,
      synced: true
    });
  }

  transactions.reverse();

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    transactions: transactions
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Extracted Data") || ss.getSheets()[0];

    if (sheet.getName() === "Sheet1") {
      try { sheet.setName("Extracted Data"); } catch(err) {}
    }

    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }

    if (requestData.action === "ping" || requestData.test) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "PayLens Webhook connected successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (requestData.action === "updateAuth") {
      var authSheet = ss.getSheetByName("_PayLens_Auth");
      if (!authSheet) {
        authSheet = ss.insertSheet("_PayLens_Auth");
      }
      authSheet.clear();
      authSheet.appendRow(["Username", "PasswordHash", "FullName", "UpdatedAt"]);
      authSheet.appendRow([
        requestData.username || "pradeep",
        requestData.passwordHash || "",
        requestData.fullName || "PRADEEP KUMAR SHARMA",
        new Date().toISOString()
      ]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Auth credentials synced to Google Sheet successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (requestData.action === "deleteTransaction") {
      var targetTxnId = requestData.transactionId;
      var targetTimestamp = requestData.timestamp;
      var lastRow = sheet.getLastRow();
      var deleted = false;
      if (lastRow > 1) {
        var range = sheet.getRange(2, 1, lastRow - 1, 8);
        var values = range.getValues();
        for (var r = values.length - 1; r >= 0; r--) {
          var rowTxn = String(values[r][7] || "").replace(/^'/, "");
          var rowTime = String(values[r][0] || "");
          if ((targetTxnId && targetTxnId !== "N/A" && rowTxn === targetTxnId) ||
              (targetTimestamp && rowTime === targetTimestamp)) {
            sheet.deleteRow(r + 2);
            deleted = true;
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: deleted ? "success" : "not_found",
        message: deleted ? "Row deleted" : "Row not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (requestData.action === "clearAll") {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "All records cleared"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (sheet.getLastRow() === 0) {
      var headers = [
        "Timestamp",
        "Payment App",
        "Type (Sent/Received)",
        "From (Sender)",
        "To (Receiver)",
        "Amount",
        "Date & Time",
        "Transaction ID / UTR",
        "Screenshot Info"
      ];
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#4338ca");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var txnId = requestData.transactionId ? "'" + requestData.transactionId : "N/A";
    var screenshotCell = "No Screenshot";
    var base64Data = requestData.screenshotBase64 || (requestData.screenshotUrl && requestData.screenshotUrl.indexOf("data:image") !== -1 ? requestData.screenshotUrl : null);

    if (base64Data && base64Data.indexOf("data:image") !== -1) {
      try {
        var folderName = "PayLens Receipts";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

        var parts = base64Data.split(",");
        var contentType = parts[0].split(":")[1].split(";")[0];
        var decoded = Utilities.base64Decode(parts[1]);
        var fileName = (requestData.appName || "Payment") + "_" + (requestData.transactionId || Date.now()) + ".jpg";
        var blob = Utilities.newBlob(decoded, contentType, fileName);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        var fileUrl = file.getUrl();
        screenshotCell = '=HYPERLINK("' + fileUrl + '", "🖼️ View Screenshot")';
      } catch (driveErr) {
        screenshotCell = "Attached in Dashboard";
      }
    } else if (requestData.screenshotUrl && requestData.screenshotUrl.indexOf("http") === 0) {
      screenshotCell = '=HYPERLINK("' + requestData.screenshotUrl + '", "🖼️ View Screenshot")';
    }

    sheet.appendRow([
      requestData.timestamp || new Date().toISOString(),
      requestData.appName || "N/A",
      requestData.type || "Sent",
      requestData.from || "N/A",
      requestData.to || "N/A",
      requestData.amount || "₹0.00",
      requestData.dateTime || "N/A",
      txnId,
      screenshotCell
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row appended with screenshot link successfully"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;

export default function BackendSetupModal({ 
  isOpen, 
  onClose, 
  onWebhookUpdated, 
  currentUser,
  onUserUpdated 
}) {
  const [activeTab, setActiveTab] = useState('supabase'); // 'supabase' | 'sheets' | 'settings' | 'security'
  const [webhookUrl, setWebhookState] = useState(getWebhookUrl());
  const [geminiKey, setGeminiState] = useState(getGeminiApiKey());
  
  // Supabase state
  const supabaseCfg = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrlState] = useState(supabaseCfg.url);
  const [supabaseKey, setSupabaseKeyState] = useState(supabaseCfg.anonKey);
  const [isSqlCopied, setIsSqlCopied] = useState(false);
  const [isScriptCopied, setIsScriptCopied] = useState(false);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState(null);
  const [testStatus, setTestStatus] = useState(null);

  // Security Form States
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const u = currentUser || getCurrentUser();
      setProfileName(u.fullName || 'PRADEEP KUMAR SHARMA');
      setProfileUsername(u.username || 'pradeep');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityStatus(null);
      setSupabaseTestStatus(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setIsSqlCopied(true);
    setTimeout(() => setIsSqlCopied(false), 2500);
  };

  const handleCopyScript = async () => {
    await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setIsScriptCopied(true);
    setTimeout(() => setIsScriptCopied(false), 2500);
  };

  const handleTestSupabase = async () => {
    setSupabaseTestStatus({ type: 'loading', text: 'Checking Supabase database connection...' });
    setSupabaseConfig(supabaseUrl, supabaseKey);
    const res = await fetchSupabaseTransactions();
    if (res.success) {
      setSupabaseTestStatus({
        type: 'success',
        text: `Connected! Transactions table is active and accessible (${res.transactions.length} records verified).`
      });
    } else if (res.tableMissing) {
      setSupabaseTestStatus({
        type: 'warning',
        text: 'Connected to Supabase project, but "transactions" table not found yet. Click "Copy Setup SQL" above and run it in Supabase SQL Editor.'
      });
    } else {
      setSupabaseTestStatus({
        type: 'error',
        text: res.message || 'Connection failed. Please check URL & Key.'
      });
    }
  };

  const handleSaveSettings = () => {
    const formatted = setWebhookUrl(webhookUrl);
    setWebhookState(formatted);
    setGeminiApiKey(geminiKey);
    setSupabaseConfig(supabaseUrl, supabaseKey);
    onWebhookUpdated?.(formatted);
    setTestStatus({
      type: 'success',
      text: 'Settings saved to browser storage successfully!'
    });
  };

  const handleTestConnection = async () => {
    if (!webhookUrl) {
      setTestStatus({ type: 'error', text: 'Please enter a Google Apps Script Web App URL or Deployment ID.' });
      return;
    }
    setTestStatus({ type: 'loading', text: 'Testing webhook reachability...' });
    const result = await testWebhookConnection(webhookUrl);
    if (result.valid) {
      const formatted = result.formattedUrl || webhookUrl;
      setWebhookState(formatted);
      setTestStatus({ type: 'success', text: result.message });
      setWebhookUrl(formatted);
      onWebhookUpdated?.(formatted);
    } else {
      setTestStatus({ type: 'error', text: result.message });
    }
  };

  const handleSecurityUpdate = async (e) => {
    e.preventDefault();
    setSecurityStatus(null);

    if (!currentPassword) {
      setSecurityStatus({
        type: 'error',
        text: 'Please enter your current password to authorize changes.'
      });
      return;
    }

    if (!profileUsername.trim()) {
      setSecurityStatus({
        type: 'error',
        text: 'Username cannot be blank.'
      });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setSecurityStatus({
        type: 'error',
        text: 'New password and confirmation do not match.'
      });
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setSecurityStatus({
        type: 'error',
        text: 'New password must be at least 4 characters long.'
      });
      return;
    }

    setIsUpdatingSecurity(true);
    try {
      const res = await updateCredentials({
        currentPassword,
        newUsername: profileUsername,
        newPassword: newPassword || undefined,
        newFullName: profileName
      });

      if (res.success) {
        setSecurityStatus({
          type: 'success',
          text: 'Account & Security credentials updated across devices!'
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onUserUpdated?.(res.user);
      } else {
        setSecurityStatus({
          type: 'error',
          text: res.message || 'Failed to update credentials.'
        });
      }
    } catch (err) {
      setSecurityStatus({
        type: 'error',
        text: err.message || 'An error occurred while saving.'
      });
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative max-w-3xl w-full max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cloud Backend &amp; Security</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Supabase PostgreSQL, Google Sheets, &amp; Account Protection</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'supabase'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Supabase Cloud (Active)</span>
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Google Apps Script</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Account Security</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {activeTab === 'supabase' ? (
            <div className="space-y-4">
              {/* Connected Banner */}
              <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-950 dark:text-emerald-200 space-y-2.5">
                <div className="font-bold flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Supabase Connected: <span className="font-mono text-xs">pewltrcchohaylamincw</span>
                  </div>
                  <a
                    href="https://supabase.com/dashboard/project/pewltrcchohaylamincw/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition"
                  >
                    Open SQL Editor <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
                  To complete the multi-device sync setup, copy the ready SQL script below, open the Supabase SQL Editor, paste it, and click <b>RUN</b>. This creates your tables, real-time live sync, and receipt image storage.
                </p>
              </div>

              {/* SQL Code Block */}
              <div className="relative">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 px-4 py-2.5 rounded-t-2xl border border-b-0 border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-mono font-medium">supabase_setup.sql</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySql}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm"
                    >
                      {isSqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {isSqlCopied ? 'Copied SQL' : 'Copy Setup SQL'}
                    </button>
                  </div>
                </div>
                <pre className="font-mono text-xs bg-slate-900 dark:bg-slate-950 p-4 rounded-b-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto text-emerald-300 max-h-[260px]">
                  <code>{SUPABASE_SETUP_SQL}</code>
                </pre>
              </div>

              {/* Test Supabase Connection */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleTestSupabase}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Test Database Connection
                </button>
              </div>

              {supabaseTestStatus && (
                <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 font-medium ${
                  supabaseTestStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : supabaseTestStatus.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : supabaseTestStatus.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300'
                }`}>
                  {supabaseTestStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : supabaseTestStatus.type === 'warning' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span>{supabaseTestStatus.text}</span>
                </div>
              )}
            </div>
          ) : activeTab === 'sheets' ? (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-indigo-700 dark:text-white">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Google Sheets Multi-Device Script:
                </div>
                <p className="text-[11px] text-indigo-950/80 dark:text-indigo-300/90">
                  If you also want to mirror records into your Google Sheet, paste this script in your sheet:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-indigo-950/80 dark:text-indigo-300/90 ml-1">
                  <li>Open your Google Sheet: <a href="https://sheets.new" target="_blank" rel="noreferrer" className="underline font-semibold">sheets.new</a></li>
                  <li>Click <b>Extensions</b> &gt; <b>Apps Script</b> in top menu bar.</li>
                  <li>Replace default code with snippet below and click <b>Save</b> (Ctrl+S).</li>
                  <li>Click <b>Deploy</b> &gt; <b>New deployment</b> &gt; Type: <b>Web app</b> &gt; Who has access: <b>Anyone</b> &gt; Click <b>Deploy</b>.</li>
                </ol>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 px-4 py-2.5 rounded-t-2xl border border-b-0 border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-mono font-medium">GoogleAppsScript.gs</span>
                  <button
                    onClick={handleCopyScript}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
                  >
                    {isScriptCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {isScriptCopied ? 'Copied to Clipboard' : 'Copy Script'}
                  </button>
                </div>
                <pre className="font-mono text-xs bg-slate-900 dark:bg-slate-950 p-4 rounded-b-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto text-slate-200 max-h-[260px]">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* Supabase URL and Key */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrlState(e.target.value)}
                  placeholder="https://pewltrcchohaylamincw.supabase.co"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Supabase Anon / Public Key
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKeyState(e.target.value)}
                  placeholder="sb_publishable_..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Webhook URL Input */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Google Apps Script Web App URL (Optional Fallback)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookState(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  <button
                    onClick={handleTestConnection}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Test Connection
                  </button>
                </div>
              </div>

              {/* Gemini API Key Input */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Google Gemini 2.5 Flash API Key (Optional)
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Get Free Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiState(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Status Message */}
              {testStatus && (
                <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 font-medium ${
                  testStatus.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : testStatus.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300'
                }`}>
                  {testStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : testStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span>{testStatus.text}</span>
                </div>
              )}
            </div>
          ) : (
            /* Tab 4: Security & Credentials */
            <form onSubmit={handleSecurityUpdate} className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Personal Vault Protection
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Update your full name, login username, or change password. All credentials are encrypted using SHA-256 Web Crypto and synced to Supabase.
                  </p>
                </div>
              </div>

              {securityStatus && (
                <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 font-medium ${
                  securityStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}>
                  {securityStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{securityStatus.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Your Full Name (Welcome Display)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="e.g. PRADEEP KUMAR SHARMA"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Login Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value)}
                      placeholder="e.g. pradeep"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password (default: admin)"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      New Password (Optional)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingSecurity}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                  {isUpdatingSecurity ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Update Account Credentials
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {activeTab === 'supabase'
              ? 'Multi-Device Cloud Database Active'
              : activeTab === 'sheets' 
              ? 'Copy script and deploy as Web App' 
              : activeTab === 'settings'
              ? 'Values stored securely in browser'
              : 'Secured for PRADEEP KUMAR SHARMA'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            >
              Close
            </button>
            {activeTab === 'settings' && (
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
              >
                Save Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
