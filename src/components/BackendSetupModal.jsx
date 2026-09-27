import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, ExternalLink, Database, 
  Key, Sparkles, AlertCircle, CheckCircle2, RefreshCw, 
  ShieldCheck, User, Lock, Eye, EyeOff, Shield
} from 'lucide-react';
import { getWebhookUrl, setWebhookUrl, testWebhookConnection } from '../services/sheetsService';
import { getGeminiApiKey, setGeminiApiKey } from '../services/ocrService';
import { updateCredentials, getCurrentUser } from '../services/authService';

const GOOGLE_APPS_SCRIPT_CODE = `/**
 * PayLens - Google Apps Script Webhook Backend
 * Paste this into: Extensions > Apps Script in your Google Sheet
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other concurrent requests
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Target the primary first sheet (Sheet1 / gid=0) directly
    var sheet = ss.getSheets()[0];

    // Automatically rename Sheet1 to Extracted Data if applicable
    if (sheet.getName() === "Sheet1") {
      try { sheet.setName("Extracted Data"); } catch(e) {}
    }

    // Automatically create headers if sheet is empty
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
      headerRange.setBackground("#4338ca"); // Indigo color
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    // Parse incoming JSON body
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }

    // Respond to ping / test healthcheck
    if (requestData.action === "ping" || requestData.test) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "PayLens Webhook connected successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Format transaction ID with leading quote to preserve 12 digits from scientific notation
    var txnId = requestData.transactionId ? "'" + requestData.transactionId : "N/A";

    // Process Screenshot: Save image to Google Drive & Create Viewable Link
    var screenshotCell = "No Screenshot";
    var base64Data = requestData.screenshotBase64 || requestData.screenshotUrl;

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

    // Append new structured payment record row
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
  const [activeTab, setActiveTab] = useState('sheets'); // 'sheets' | 'settings' | 'security'
  const [webhookUrl, setWebhookState] = useState(getWebhookUrl());
  const [geminiKey, setGeminiState] = useState(getGeminiApiKey());
  const [isCopied, setIsCopied] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // { type: 'loading'|'success'|'error', text: '' }

  // Security Form States
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [securityStatus, setSecurityStatus] = useState(null); // { type: 'success'|'error', text: '' }
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
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSaveSettings = () => {
    const formatted = setWebhookUrl(webhookUrl);
    setWebhookState(formatted);
    setGeminiApiKey(geminiKey);
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
          text: 'Account & Security credentials updated successfully!'
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
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Settings &amp; Configuration</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Google Sheets Webhook, Vision API &amp; Account Security</p>
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
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-6 gap-2">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'sheets'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Google Apps Script</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Webhook &amp; AI Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
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
          {activeTab === 'sheets' ? (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-indigo-700 dark:text-white">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Quick 4-Step Google Sheet Integration:
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-indigo-950/80 dark:text-indigo-300/90 ml-1">
                  <li>Open your Google Sheet (or create a new blank one).</li>
                  <li>Click <b>Extensions</b> &gt; <b>Apps Script</b> in top menu bar.</li>
                  <li>Replace default code with snippet below and click <b>Save</b> (Ctrl+S).</li>
                  <li>Click <b>Deploy</b> &gt; <b>New deployment</b> &gt; Select type: <b>Web app</b> &gt; Set <i>Who has access:</i> <b>Anyone</b> &gt; Click <b>Deploy</b>.</li>
                </ol>
                <div className="text-[11px] text-amber-700 dark:text-amber-300/90 pt-1 font-medium">
                  ⚠️ Note: Setting "Who has access" to "Anyone" allows this dashboard app to post records securely into your sheet.
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 px-4 py-2.5 rounded-t-2xl border border-b-0 border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-mono font-medium">GoogleAppsScript.gs</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {isCopied ? 'Copied to Clipboard' : 'Copy Script'}
                  </button>
                </div>
                <pre className="font-mono text-xs bg-slate-900 dark:bg-slate-950 p-4 rounded-b-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto text-slate-200 max-h-[280px]">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* Webhook URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Google Apps Script Web App URL (`WEBHOOK_URL`)
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
                <p className="text-[11px] text-slate-500">
                  Paste the Web App URL generated after clicking Deploy &gt; Web App in Google Apps Script.
                </p>
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
                <p className="text-[11px] text-slate-500">
                  By default, local in-browser OCR (Tesseract.js) runs 100% free with zero configuration. Providing a Gemini API key upgrades extraction to multi-modal vision AI.
                </p>
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
            /* Tab 3: Security & Credentials */
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
                    Update your full name, login username, or change password. All credentials are encrypted using SHA-256 Web Crypto.
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
            {activeTab === 'sheets' 
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
