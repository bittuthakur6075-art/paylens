import React, { useState, useEffect } from 'react';
import { 
  Lock, User, Eye, EyeOff, ShieldCheck, 
  Sparkles, ArrowRight, AlertCircle, KeyRound, CheckCircle2, 
  Zap, Shield
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { login, getCurrentUser } from '../services/authService';
import { fetchSupabaseAuth } from '../services/supabaseService';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [vaultOwner, setVaultOwner] = useState(() => getCurrentUser()?.fullName || 'PRADEEP KUMAR SHARMA');

  // Dynamically load vault owner name from Supabase cloud
  useEffect(() => {
    fetchSupabaseAuth()
      .then(res => {
        if (res.success && res.user && res.user.fullName) {
          setVaultOwner(res.user.fullName);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await login(username, password);
      if (result.success) {
        // Trigger celebratory confetti in emerald & gold
        try {
          confetti({
            particleCount: 80,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#10b981', '#059669', '#34d399', '#f59e0b']
          });
        } catch (e) {}

        setWelcomeUser(result.user);

        // Transition to dashboard after 2.2 seconds
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 2200);
      } else {
        setErrorMessage(result.message || 'Invalid credentials. Please verify your username and password.');
      }
    } catch (err) {
      setErrorMessage('Authentication error. Please check your cloud connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Light Theme Welcome Screen
  if (welcomeUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 text-slate-900 selection:bg-emerald-500 selection:text-white overflow-hidden font-sans">
        {/* Soft background ambient glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-500 p-8 sm:p-10 rounded-3xl bg-white/95 border border-slate-200/80 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
          {/* Animated Avatar Icon */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 p-0.5 shadow-xl shadow-emerald-500/20 animate-bounce duration-1000">
            <div className="w-full h-full bg-white rounded-[22px] flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white shadow-md">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Authenticated Successfully
            </div>
            <h2 className="text-xs font-semibold text-slate-400 tracking-wider uppercase mt-2">
              Welcome back
            </h2>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {welcomeUser.fullName || vaultOwner}
            </h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto pt-1">
              Your financial extraction vault is ready. Loading dashboard...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-semibold text-emerald-600">Opening Dashboard</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Light Theme Login Form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 text-slate-900 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Soft ambient gradient orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-md w-full rounded-3xl bg-white/95 border border-slate-200/90 p-7 sm:p-9 shadow-2xl shadow-slate-200/60 backdrop-blur-xl space-y-6">
        {/* Brand & Security Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center shadow-md shadow-emerald-500/10">
            <Zap className="w-7 h-7 text-emerald-600 fill-emerald-600/10" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              PayLens
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                Vault
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Personal Financial Vault for <strong className="text-slate-800">{vaultOwner}</strong>
            </p>
          </div>

          {/* Secure Cloud Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cloud Database Protected</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-1 rounded text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/35 transition duration-200 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 text-white">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying Access...
              </span>
            ) : (
              <>
                Unlock Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Minimal Security Badge */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>End-to-End Encrypted Cloud Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
