import React, { useState } from 'react';
import { 
  Settings, Key, User, Lock, Eye, EyeOff, ShieldCheck, 
  Sun, Moon, Trash2, CheckCircle2, AlertCircle, Sparkles, HardDrive, Mail
} from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../services/ocrService';
import { updateCredentials, getCurrentUser, validatePasswordStrength, getRecoveryEmail } from '../services/authService';

export default function SettingsPage({ 
  currentUser, 
  onUserUpdated, 
  theme = 'dark', 
  onToggleTheme,
  transactions = []
}) {
  const activeUser = currentUser || getCurrentUser();

  // Profile credentials
  const [profileName, setProfileName] = useState(activeUser?.fullName || 'PRADEEP KUMAR SHARMA');
  const [profileUsername, setProfileUsername] = useState(activeUser?.username || 'pradeep');
  const [recoveryEmail, setRecoveryEmailInput] = useState(() => activeUser?.email || getRecoveryEmail());
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  // Gemini API Key
  const [geminiKeyInput, setGeminiKeyInput] = useState(getGeminiApiKey() || '');
  const [geminiFeedback, setGeminiFeedback] = useState(null);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileFeedback(null);

    const cleanEmail = (recoveryEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setProfileFeedback({ type: 'error', message: 'Please enter a valid email address for OTP recovery.' });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setProfileFeedback({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    if (newPassword) {
      const strength = validatePasswordStrength(newPassword);
      if (strength.isBreachedRisk) {
        setProfileFeedback({
          type: 'error',
          message: 'Security Alert: "' + newPassword.trim() + '" is a widely leaked password on the internet that triggers browser warnings. Please choose a unique password.'
        });
        return;
      }
      if (newPassword.trim().length < 4) {
        setProfileFeedback({ type: 'error', message: 'New password must be at least 4 characters long.' });
        return;
      }
    }

    try {
      const res = await updateCredentials({
        newUsername: (profileUsername || '').trim(),
        newFullName: (profileName || '').trim(),
        newPassword: newPassword ? newPassword.trim() : undefined,
        email: cleanEmail
      });

      if (res.success) {
        setProfileFeedback({ type: 'success', message: 'Profile & credentials updated successfully across devices!' });
        setNewPassword('');
        setConfirmPassword('');
        if (onUserUpdated && res.user) {
          onUserUpdated(res.user);
        }
      } else {
        setProfileFeedback({ type: 'error', message: res.message || 'Failed to update credentials' });
      }
    } catch (err) {
      setProfileFeedback({ type: 'error', message: err.message || 'Error updating profile' });
    }
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(geminiKeyInput.trim());
    setGeminiFeedback({ type: 'success', message: 'Gemini AI API Key saved.' });
    setTimeout(() => setGeminiFeedback(null), 3000);
  };

  const handleClearCache = () => {
    if (window.confirm('Clear temporary local image caches? Your cloud records will remain safely intact.')) {
      try {
        localStorage.removeItem('paylens_clean_transactions');
        alert('Local cache refreshed. Click "Sync" to reload records from cloud.');
        window.location.reload();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Account &amp; Security Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your personal profile, authentication credentials, AI extraction keys, and storage
          </p>
        </div>
      </div>

      {/* Profile & Credentials */}
      <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" />
          Personal Profile &amp; Login
        </h3>

        {profileFeedback && (
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
            profileFeedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
          }`}>
            {profileFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{profileFeedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={profileUsername}
              onChange={(e) => setProfileUsername(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                Registered Recovery Email (OTP Login &amp; Password Recovery)
              </span>
              <span className="text-[10px] text-emerald-500 font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Active for Email OTP
              </span>
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmailInput(e.target.value)}
                placeholder="sharmab7615@gmail.com"
                required
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Password bhulne par is email address par OTP aayega jisse aap turant login kar sakte hain. Aap ise kabhi bhi yahan se badal sakte hain.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password (Leave blank to keep current)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (() => {
              const str = validatePasswordStrength(newPassword);
              return (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-semibold ${
                      str.color === 'rose' ? 'text-rose-500' :
                      str.color === 'amber' ? 'text-amber-500' :
                      str.color === 'sky' ? 'text-sky-500' : 'text-emerald-500'
                    }`}>
                      {str.label}
                    </span>
                    <span className="text-slate-400 text-[10px]">{str.message}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex gap-0.5">
                    <div className={`h-full flex-1 rounded-full ${str.score >= 1 ? (str.isBreachedRisk ? 'bg-rose-500' : 'bg-amber-400') : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 rounded-full ${str.score >= 2 && !str.isBreachedRisk ? 'bg-sky-400' : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 rounded-full ${str.score >= 3 && !str.isBreachedRisk ? 'bg-emerald-500' : 'bg-transparent'}`} />
                  </div>
                </div>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm"
          >
            Save Profile Changes
          </button>
        </div>
      </form>

      {/* Gemini AI OCR API Key */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Gemini AI OCR Engine Key (Optional)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            PayLens automatically uses built-in Tesseract.js client OCR. You can also provide a Gemini API key for complex receipt understanding.
          </p>
        </div>

        {geminiFeedback && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{geminiFeedback.message}</span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
          />
          <button
            onClick={handleSaveGeminiKey}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
          >
            Save Key
          </button>
        </div>
      </div>

      {/* Preferences & Storage */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-500" />
          Appearance &amp; Local Storage
        </h3>

        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Dashboard Color Theme</p>
            <p className="text-[11px] text-slate-400">Current theme: {theme === 'dark' ? 'Dark Obsidian' : 'Clean White'}</p>
          </div>
          <button
            onClick={onToggleTheme}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            <span>Switch to {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Local Cache &amp; Storage</p>
            <p className="text-[11px] text-slate-400">{transactions.length} records saved in browser local storage</p>
          </div>
          <button
            onClick={handleClearCache}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Local Cache</span>
          </button>
        </div>
      </div>
    </div>
  );
}
