import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Sparkles, Send, 
  RefreshCw, CheckCircle2, AlertCircle, X, Eye, 
  FileCheck, Shield, ChevronDown, Wand2, ArrowRightLeft,
  Zap,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  extractReceiptData, 
  getGeminiApiKey, 
  setGeminiApiKey, 
  warmupOCR, 
  getOCRMode, 
  setOCRMode 
} from '../services/ocrService';

const COMMON_APPS = [
  'PhonePe',
  'Google Pay',
  'Paytm',
  'CRED',
  'BHIM',
  'Amazon Pay',
  'WhatsApp Pay',
  'SBI',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Bank',
  'PNB',
  'Bank of Baroda',
  'Canara Bank',
  'Other UPI'
];

export default function UploadForm({ 
  onSubmitTransaction, 
  onViewImage, 
  webhookUrl,
  onSwitchToImport,
  userRole = 'write'
}) {
  const isReadOnly = userRole === 'read';
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // OCR processing state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ progress: 0, message: '' });
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [ocrMode, setOcrModeState] = useState(() => getOCRMode());
  const [extractDuration, setExtractDuration] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    appName: 'PhonePe',
    type: 'Sent',
    from: '',
    to: '',
    amount: '',
    dateTime: '',
    transactionId: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // Pre-warm OCR worker in the background immediately
  useEffect(() => {
    warmupOCR();
  }, []);

  // Gemini Vision AI Key State for 100% accurate receipt extraction
  const [geminiApiKey, setGeminiApiKeyState] = useState(getGeminiApiKey());
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const handleSaveGeminiKey = (key) => {
    setGeminiApiKey(key);
    setGeminiApiKeyState(key ? key.trim() : '');
    setShowKeyModal(false);
    if (key?.trim()) {
      handleModeChange('ai');
    } else if (imagePreview) {
      handleAutoExtract(imagePreview);
    }
  };

  const handleModeChange = (newMode) => {
    setOCRMode(newMode);
    setOcrModeState(newMode);
    if (imagePreview) {
      handleAutoExtract(imagePreview, newMode);
    }
  };

  // Allow pasting screenshot from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          handleSelectedFile(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleSelectedFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setExtractError('Please upload an image file (PNG, JPG, JPEG, WebP).');
      return;
    }

    setExtractError(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      setImagePreview(base64Data);
      setIsAutoFilled(false);
      // Automatically trigger extraction on upload without needing extra click!
      handleAutoExtract(base64Data);
    };
    reader.readAsDataURL(file);
  };

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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleSelectedFile(files[0]);
    }
  };

  const handleAutoExtract = async (targetSource = null, overrideMode = null) => {
    const validTarget = (typeof targetSource === 'string' && targetSource.length > 0) ? targetSource : null;
    const imgSource = validTarget || imagePreview;
    if (!imgSource) {
      setExtractError('Please upload or choose a payment screenshot first.');
      return;
    }

    const modeToUse = overrideMode || ocrMode;
    const startTime = Date.now();
    setExtractDuration(null);
    setIsExtracting(true);
    setExtractError(null);
    setExtractProgress({ 
      progress: 20, 
      message: modeToUse === 'fast' ? '⚡ Lightning scan starting...' : 'Contacting AI Vision...' 
    });

    try {
      const extracted = await extractReceiptData(imgSource, (update) => {
        setExtractProgress({
          progress: update.progress || 50,
          message: update.message || 'Extracting recipient, amount & transaction info...'
        });
      }, { mode: modeToUse });

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      setExtractDuration(durationSec);

      // Update form state with parsed values
      setFormData(prev => ({
        ...prev,
        appName: (extracted.appName && extracted.appName !== 'Unknown') ? extracted.appName : prev.appName,
        type: extracted.type || prev.type,
        from: (extracted.from !== undefined && extracted.from !== '') ? extracted.from : (extracted.type === 'Sent' ? 'You (Self)' : prev.from),
        to: (extracted.to !== undefined && extracted.to !== '') ? extracted.to : (extracted.type === 'Received' ? 'You (Self)' : prev.to),
        amount: extracted.amount || prev.amount,
        dateTime: extracted.dateTime || prev.dateTime,
        transactionId: extracted.transactionId || prev.transactionId
      }));

      setIsAutoFilled(true);
      try {
        confetti({
          particleCount: 25,
          spread: 50,
          origin: { y: 0.8 }
        });
      } catch {
        // Non-critical visual effect
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setExtractError(`Extraction notice: ${err.message || 'Could not parse text'}. You can fill/edit the fields below manually.`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsAutoFilled(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetForm = () => {
    handleClearImage();
    setFormData({
      appName: 'PhonePe',
      type: 'Sent',
      from: '',
      to: '',
      amount: '',
      dateTime: '',
      transactionId: ''
    });
    setSubmitFeedback(null);
    setExtractError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount) {
      setExtractError('Please specify the transaction Amount.');
      return;
    }

    setIsSubmitting(true);
    setSubmitFeedback(null);

    const isReceived = formData.type === 'Received';
    const cleanDateTime = formData.dateTime || new Date().toLocaleString('en-IN');
    const timeMatch = cleanDateTime.match(/\b([0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:AM|PM|am|pm)?)\b/);

    const payload = {
      appName: formData.appName,
      type: formData.type,
      from: formData.from || (formData.type === 'Sent' ? 'You (Self)' : 'Customer'),
      to: formData.to || (formData.type === 'Received' ? 'You (Self)' : 'Merchant'),
      amount: formData.amount,
      dateTime: cleanDateTime,
      transactionId: formData.transactionId || `TXN${Date.now().toString().slice(-8)}`,
      screenshotUrl: imagePreview || null,
      id: `tx-${Date.now()}`,
      // 10 Standard Schema Fields
      date: cleanDateTime.split(/[\s,]+/)[0],
      time: timeMatch ? timeMatch[1] : '',
      transactionDetails: isReceived ? formData.from : formData.to,
      otherDetails: '-',
      yourAccount: 'Self Account',
      upiRefNo: formData.transactionId || '-',
      orderId: '-',
      remarks: '-',
      tags: isReceived ? 'UPI Inflow' : 'Payment / Expense'
    };

    try {
      const response = await onSubmitTransaction(payload);
      
      // Fire celebration confetti
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (err) {
        // canvas-confetti fallback
      }

      setSubmitFeedback({
        type: 'success',
        text: response?.message || 'Transaction saved successfully!'
      });

      // Clear after submission
      setTimeout(() => {
        handleResetForm();
      }, 1800);
    } catch (err) {
      setSubmitFeedback({
        type: 'error',
        text: err.message || 'Error occurred while saving transaction.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-lg dark:shadow-xl flex flex-col gap-6 transition-colors">
      {/* Top Switcher: Single Receipt OCR vs Multi Statement Import */}
      {onSwitchToImport && (
        <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Single Receipt OCR</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToImport}
            className="flex-1 py-2 px-3 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Import Statement (PDF / Excel / CSV)</span>
            <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.2 rounded-full">
              NEW
            </span>
          </button>
        </div>
      )}

      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Screenshot Parser &amp; Input
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload receipt or paste screenshot to auto-extract
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Selector Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => handleModeChange('fast')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                ocrMode === 'fast'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Lightning local OCR engine - completes in < 1 second"
            >
              <Zap className="w-3 h-3" />
              <span>⚡ Fast (&lt;1s)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!geminiApiKey) {
                  setTempKey('');
                  setShowKeyModal(true);
                } else {
                  handleModeChange('ai');
                }
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                ocrMode === 'ai'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Google Gemini AI Vision - deep OCR parsing (max 2.5s with fast-fallback)"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>✨ AI Vision</span>
            </button>
          </div>

          {extractDuration && (
            <span 
              title={`Extracted in ${extractDuration} seconds`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono animate-in fade-in"
            >
              <Zap className="w-3 h-3" />
              {extractDuration}s
            </span>
          )}

          {isAutoFilled && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-filled
            </span>
          )}
        </div>
      </div>

      {/* Inline Gemini Key Config Box */}
      {showKeyModal && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Google Gemini Vision AI Key (100% Free)
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Get Free Key &rarr;
            </a>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Extracts amount (₹), recipient, sender, UTR &amp; app name with 100% human-level accuracy on ANY screenshot without OCR mistakes.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Paste free Gemini API key (AIzaSy...)"
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => handleSaveGeminiKey(tempKey)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
            >
              Save Key
            </button>
            <button
              type="button"
              onClick={() => setShowKeyModal(false)}
              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Read-Only Mode Notice */}
      {isReadOnly && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span><b>Read-Only Mode:</b> Your account has view-only permissions. Uploading and submitting new transactions is restricted to users with write access.</span>
        </div>
      )}

      {/* Image Dropzone & Preview Section */}
      <div className="space-y-3">
        {!imagePreview ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition duration-200 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700/80 hover:border-indigo-500 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-950/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleSelectedFile(e.target.files[0])}
              accept="image/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Drag &amp; drop payment screenshot here
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              or <span className="text-indigo-600 dark:text-indigo-400 font-semibold">browse files</span> (supports PhonePe, GPay, Paytm, CRED, Bank)
            </p>
            <div className="mt-3 px-2.5 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800/80 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
              💡 Tip: You can also press <kbd className="text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded shadow-sm border border-slate-300 dark:border-transparent">Ctrl</kbd> + <kbd className="text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded shadow-sm border border-slate-300 dark:border-transparent">V</kbd> to paste
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shrink-0 group">
                <img
                  src={imagePreview}
                  alt="Receipt Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onViewImage({
                    screenshotUrl: imagePreview,
                    appName: formData.appName,
                    amount: formData.amount,
                    type: formData.type,
                    from: formData.from,
                    to: formData.to,
                    transactionId: formData.transactionId,
                    dateTime: formData.dateTime
                  })}
                  title="Expand Full Preview"
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Receipt Image Loaded
                  </span>
                  <button
                    type="button"
                    onClick={handleClearImage}
                    title="Remove image"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Ready for scanning &amp; OCR processing
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAutoExtract()}
                    disabled={isExtracting}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                  >
                    {isExtracting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    {isExtracting ? 'Extracting...' : 'Auto-Extract Data'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewImage({
                      screenshotUrl: imagePreview,
                      appName: formData.appName,
                      amount: formData.amount,
                      type: formData.type,
                      from: formData.from,
                      to: formData.to,
                      transactionId: formData.transactionId,
                      dateTime: formData.dateTime
                    })}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                </div>
              </div>
            </div>

            {/* OCR Progress Bar */}
            {isExtracting && (
              <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-indigo-300 font-medium">
                  <span>{extractProgress.message}</span>
                  <span>{extractProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${extractProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error or Notice Alert */}
      {extractError && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{extractError}</span>
        </div>
      )}

      {/* Structured Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: App Name & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Payment App
            </label>
            <div className="relative">
              <select
                name="appName"
                value={formData.appName}
                onChange={handleFormChange}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 pr-8 font-medium"
              >
                {COMMON_APPS.map(app => (
                  <option key={app} value={app} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{app}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, type: 'Sent' }))}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  formData.type === 'Sent'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Sent (Debit)
              </button>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, type: 'Received' }))}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  formData.type === 'Received'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Received (Credit)
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: From & To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              From (Sender)
            </label>
            <input
              type="text"
              name="from"
              value={formData.from}
              onChange={handleFormChange}
              placeholder="Sender Name / Account"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              To (Receiver / Merchant)
            </label>
            <input
              type="text"
              name="to"
              value={formData.to}
              onChange={handleFormChange}
              placeholder="Receiver or Merchant Name"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>
        </div>

        {/* Row 3: Amount & UTR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Amount (₹) *
            </label>
            <input
              type="text"
              name="amount"
              required
              value={formData.amount}
              onChange={handleFormChange}
              placeholder="e.g. ₹500.00"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Transaction ID / UTR
            </label>
            <input
              type="text"
              name="transactionId"
              value={formData.transactionId}
              onChange={handleFormChange}
              placeholder="12-digit UTR or Txn ID"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Row 4: Date & Time */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Date &amp; Time
            </label>
            <button
              type="button"
              onClick={() => setFormData(p => ({
                ...p,
                dateTime: new Date().toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })
              }))}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold"
            >
              Set Current Time
            </button>
          </div>
          <input
            type="text"
            name="dateTime"
            value={formData.dateTime}
            onChange={handleFormChange}
            placeholder="e.g. 27 Sep 2026, 04:30 PM"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
          />
        </div>

        {/* Feedback Alert */}
        {submitFeedback && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
            submitFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}>
            {submitFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{submitFeedback.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={isSubmitting || isReadOnly}
            title={isReadOnly ? 'Read-only accounts cannot submit transactions' : 'Submit transaction to cloud ledger'}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending to Google Sheets...
              </>
            ) : isReadOnly ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Read-Only (Submission Disabled)
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit to Google Sheet
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-semibold transition"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
