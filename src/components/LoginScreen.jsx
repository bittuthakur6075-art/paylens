import React, { useState } from 'react';
import { 
  Lock, User, Eye, EyeOff, ShieldCheck, 
  Sparkles, ArrowRight, AlertCircle, KeyRound, CheckCircle2 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { login } from '../services/authService';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeUser, setWelcomeUser] = useState(null); // When set, shows welcome animation screen!

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
        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 75,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch (e) {}

        // Show personalized Welcome Screen
        setWelcomeUser(result.user);

        // Transition to dashboard after 2.4 seconds
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 2400);
      } else {
        setErrorMessage(result.message || 'Invalid credentials.');
      }
    } catch (err) {
      setErrorMessage('An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Personalized Welcome Celebration Screen
  if (welcomeUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 text-white selection:bg-indigo-500 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/25 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-lg w-full text-center space-y-6 animate-in zoom-in-95 duration-500 p-8 rounded-3xl bg-slate-900/80 border border-slate-700/80 shadow-2xl backdrop-blur-2xl">
          {/* Animated Avatar Icon */}
          <div className="relative mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-1 shadow-2xl shadow-indigo-500/40 animate-bounce duration-1000">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-emerald-500 text-white shadow-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-bold text-indigo-400 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Authenticated Successfully
            </div>
            <h2 className="text-sm font-medium text-slate-400 tracking-wider uppercase mt-2">
              Welcome
            </h2>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
              {welcomeUser.fullName || 'PRADEEP KUMAR SHARMA'}
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto pt-1">
              Your personal PayLens financial extraction vault is ready. Loading dashboard...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-xs font-mono text-indigo-300">Opening Dashboard</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Login Form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Decorative ambient gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
        {/* Brand & Security Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-xl shadow-indigo-600/30 flex items-center justify-center mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Lock className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            PayLens Security Access
          </h1>
          <p className="text-xs text-slate-400">
            Personal vault reserved for <span className="text-indigo-400 font-semibold">PRADEEP KUMAR SHARMA</span>
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
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
                placeholder="Enter username"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-medium"
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
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition duration-200 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              <>
                Unlock Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Info & Default Hint */}
        <div className="pt-2 border-t border-slate-800/80 text-center space-y-1.5">
          <p className="text-[11px] text-slate-500">
            Encrypted session protection enabled.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400">
            💡 Default Login: <span className="text-indigo-400 font-mono font-semibold">pradeep</span> / Password: <span className="text-indigo-400 font-mono font-semibold">admin</span>
            <div className="text-[10px] text-slate-500 mt-0.5">
              (You can change your username &amp; password anytime in Settings)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
