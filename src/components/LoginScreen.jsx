import React, { useState, useEffect } from 'react';
import { 
  Lock, User, Eye, EyeOff, ShieldCheck, 
  Sparkles, ArrowRight, AlertCircle, KeyRound, CheckCircle2, 
  Database, Zap, Terminal, ShieldAlert
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

  const handleQuickFill = () => {
    setUsername('pradeep');
    setPassword('admin');
    setErrorMessage('');
  };

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
            colors: ['#3ecf8e', '#10b981', '#6ee7b7', '#f59e0b']
          });
        } catch (e) {}

        setWelcomeUser(result.user);

        // Transition to dashboard
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 2200);
      } else {
        setErrorMessage(result.message || 'Invalid credentials. Please verify username and password.');
      }
    } catch (err) {
      setErrorMessage('Authentication error. Please check cloud connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Supabase Aesthetic Welcome Splash
  if (welcomeUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c0d0e] text-white selection:bg-[#3ecf8e] selection:text-black overflow-hidden font-sans">
        {/* Ambient Supabase emerald glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#3ecf8e]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-500 p-8 rounded-3xl bg-[#141518]/90 border border-[#27292f] shadow-2xl backdrop-blur-2xl">
          {/* Animated Bolt Avatar */}
          <div className="relative mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#3ecf8e] via-emerald-400 to-teal-500 p-0.5 shadow-2xl shadow-emerald-500/30 animate-pulse duration-1000">
            <div className="w-full h-full bg-[#0c0d0e] rounded-[22px] flex items-center justify-center">
              <Zap className="w-12 h-12 text-[#3ecf8e] fill-[#3ecf8e]/20" />
            </div>
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-[#3ecf8e] text-black shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-black font-black" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 text-xs font-mono font-bold text-[#3ecf8e] uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              Supabase Auth Verified
            </div>
            <h2 className="text-xs font-mono text-slate-400 tracking-wider uppercase mt-2">
              Welcome back
            </h2>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {welcomeUser.fullName || vaultOwner}
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto pt-1 font-mono">
              PostgreSQL Database &amp; Storage Connected. Initializing workspace...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#3ecf8e] animate-ping" />
            <span className="text-xs font-mono text-[#3ecf8e]">Opening Live Vault</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Login Form (Supabase Dark Theme UI)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0c0d0e] text-slate-200 relative overflow-hidden font-sans selection:bg-[#3ecf8e] selection:text-black">
      {/* Subtle grid background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Supabase brand glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#3ecf8e]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-md w-full rounded-2xl bg-[#141518]/90 border border-[#27292f] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
        {/* Top glowing line accent */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#3ecf8e]/50 to-transparent rounded-t-2xl" />

        {/* Brand & Security Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1a1c20] border border-[#2e3138] flex items-center justify-center shadow-xl shadow-black/60 group">
            <Zap className="w-7 h-7 text-[#3ecf8e] fill-[#3ecf8e]/15 group-hover:scale-110 transition duration-300" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              PayLens
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e] border border-[#3ecf8e]/20 tracking-wider">
                VAULT
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Personal Financial Extractor for <strong className="text-white">{vaultOwner}</strong>
            </p>
          </div>

          {/* Connection Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b1d22] border border-[#27292f] text-[11px] font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-[#3ecf8e] animate-pulse" />
            <span className="text-slate-400">Database:</span>
            <span className="text-[#3ecf8e] font-semibold">Supabase PostgreSQL</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (default: pradeep)"
                className="w-full bg-[#0d0e11] border border-[#27292f] rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/40 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: admin)"
                className="w-full bg-[#0d0e11] border border-[#27292f] rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/40 transition font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-1 rounded text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-50 text-[#0c0d0e] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-[#3ecf8e]/20 hover:shadow-[#3ecf8e]/30 transition duration-200 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 text-[#0c0d0e]">
                <span className="w-3.5 h-3.5 border-2 border-[#0c0d0e] border-t-transparent rounded-full animate-spin" />
                Verifying via Supabase...
              </span>
            ) : (
              <>
                Access Vault Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security & Quick Fill Footer */}
        <div className="pt-2 border-t border-[#22242a] space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
              <Terminal className="w-3 h-3 text-[#3ecf8e]" />
              RLS Enabled • TLS 1.3
            </span>
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-[#3ecf8e] hover:underline font-mono text-[11px] font-semibold"
            >
              Fill Default Credentials
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#0f1013] border border-[#22242a] text-[11px] text-slate-400 flex items-start gap-2">
            <span className="text-[#3ecf8e] font-mono shrink-0">💡</span>
            <div className="space-y-0.5">
              <div>Default: <span className="text-white font-mono font-semibold">pradeep</span> / <span className="text-white font-mono font-semibold">admin</span></div>
              <div className="text-[10px] text-slate-500">
                You can change your username &amp; password anytime in Settings. Updates are permanently saved in Supabase.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
