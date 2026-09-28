import React, { useState, useEffect } from 'react';
import { 
  Lock, User, Eye, EyeOff, ShieldCheck, 
  Sparkles, ArrowRight, AlertCircle, KeyRound, CheckCircle2, 
  Mail, Send, RefreshCw, Key,
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  login, 
  getCurrentUser, 
  getRecoveryEmail, 
  requestLoginOTP, 
  verifyLoginOTP, 
  resetPasswordWithOTP 
} from '../services/authService';
import { fetchSupabaseAuth } from '../services/supabaseService';
import PayLensLogo from './PayLensLogo';

export default function LoginScreen({ onLoginSuccess }) {
  // Login Mode: 'password' | 'otp'
  const [authMode, setAuthMode] = useState('password');

  // Password Login States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email OTP Login States
  const [recoveryEmail, setRecoveryEmailState] = useState(() => getRecoveryEmail());
  const [inputEmail, setInputEmail] = useState(() => getRecoveryEmail());
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedEmail, setSimulatedEmail] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [wantsPasswordReset, setWantsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Global States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [vaultOwner, setVaultOwner] = useState(() => getCurrentUser()?.fullName || 'PRADEEP KUMAR SHARMA');

  // Dynamically load vault owner name and recovery email from Supabase cloud
  useEffect(() => {
    fetchSupabaseAuth()
      .then(res => {
        if (res.success && res.user) {
          if (res.user.fullName) setVaultOwner(res.user.fullName);
          if (res.user.email) {
            setRecoveryEmailState(res.user.email);
            setInputEmail(res.user.email);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Standard Password Login
  const handlePasswordSubmit = async (e) => {
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
        triggerSuccessCelebration(result.user);
      } else {
        setErrorMessage(result.message || 'Invalid credentials. Please verify your username and password.');
      }
    } catch {
      setErrorMessage('Authentication error. Please check your cloud connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Sending Email OTP
  const handleSendOTP = async () => {
    setIsLoading(true);
    setErrorMessage('');

    const authorized = (recoveryEmail || getRecoveryEmail()).trim().toLowerCase();
    const entered = (inputEmail || '').trim().toLowerCase();

    // Strict validation: OTP is restricted to authorized email address only
    if (entered !== authorized) {
      setIsLoading(false);
      setErrorMessage(`Access Denied: Sirf registered email (${authorized}) par hi OTP bheja ja sakta hai. Anya kisi email par OTP nahi aayega.`);
      return;
    }

    try {
      const res = await requestLoginOTP(entered);
      if (res.success) {
        setOtpSent(true);
        setResendCooldown(30);
        setSimulatedEmail(res.code);
        setOtpCode(res.code); // Pre-fill convenience
      } else {
        setErrorMessage(res.message || 'Could not send verification code.');
      }
    } catch (e) {
      setErrorMessage(e.message || 'Failed to generate OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP Verification & Optional Password Reset
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    if (wantsPasswordReset && (!newPassword || newPassword.trim().length < 4)) {
      setErrorMessage('New password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      let result;
      if (wantsPasswordReset && newPassword.trim()) {
        result = await resetPasswordWithOTP(otpCode.trim(), newPassword.trim());
      } else {
        result = await verifyLoginOTP(otpCode.trim());
      }

      if (result.success) {
        triggerSuccessCelebration(result.user);
      } else {
        setErrorMessage(result.message || 'Invalid verification code. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Celebration helper
  const triggerSuccessCelebration = (user) => {
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#34d399', '#f59e0b']
      });
    } catch {}

    setWelcomeUser(user);
    setTimeout(() => {
      onLoginSuccess(user);
    }, 2000);
  };

  // 1. Success Welcome Screen
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

  // 2. Main Login Form (Password Mode & OTP Mode)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 text-slate-900 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Soft ambient gradient orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-md w-full rounded-3xl bg-white/95 border border-slate-200/90 p-7 sm:p-9 shadow-2xl shadow-slate-200/60 backdrop-blur-xl space-y-6">
        {/* Brand & Security Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center py-1">
            <PayLensLogo className="h-10 sm:h-11 w-auto max-w-[210px]" showText={true} />
          </div>

          <div>
            <p className="text-xs text-slate-500">
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

        {/* ======================================================== */}
        {/* MODE A: STANDARD PASSWORD LOGIN                         */}
        {/* ======================================================== */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-in fade-in">
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
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('otp');
                    setErrorMessage('');
                  }}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 transition"
                >
                  <Mail className="w-3 h-3 text-emerald-500" />
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
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
        )}

        {/* ======================================================== */}
        {/* MODE B: EMAIL OTP LOGIN & PASSWORD RECOVERY             */}
        {/* ======================================================== */}
        {authMode === 'otp' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Email Info Header */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  Email OTP Authentication
                </span>
                <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Authorized Mail Only
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                Verification OTP sirf aapke registered email address par send kiya jayega:
              </p>
              <div className="font-mono font-bold text-xs sm:text-sm text-emerald-950 bg-white px-3 py-2 rounded-xl border border-emerald-200 flex items-center justify-between break-all">
                <span>{recoveryEmail}</span>
                <span className="text-[10px] font-sans text-emerald-600 font-semibold shrink-0 ml-2">Vault Owner</span>
              </div>
            </div>

            {/* Email Input Field for Confirmation */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Registered Recovery Email</span>
                <span className="text-[10px] text-slate-400">Must match authorized mail</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  placeholder="sharmab7615@gmail.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Security Rule: Kisi anya email par OTP generate nahi hoga.
              </p>
            </div>

            {/* Simulated Email Banner */}
            {simulatedEmail && (
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-1.5 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between font-bold text-indigo-900">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    Incoming Mail ({recoveryEmail})
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono">
                    Inbox
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900/90">
                  PayLens Security Code: <span className="font-mono text-base font-black text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-300 tracking-wider">{simulatedEmail}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setOtpCode(simulatedEmail)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
                >
                  ⚡ Auto-fill code into input box
                </button>
              </div>
            )}

            {!otpSent ? (
              /* Step 1: Send OTP Button */
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send OTP to Registered Mail
                </button>
              </div>
            ) : (
              /* Step 2: Enter & Verify OTP Form */
              <form onSubmit={handleVerifyOTP} className="space-y-3.5 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Enter 6-Digit OTP
                    </label>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isLoading}
                      onClick={handleSendOTP}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 transition"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.4em] text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                  />
                </div>

                {/* Optional: Reset password checkbox */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={wantsPasswordReset}
                      onChange={(e) => setWantsPasswordReset(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Also reset my password now (Optional)</span>
                  </label>

                  {wantsPasswordReset && (
                    <div className="mt-2.5 space-y-1.5 animate-in fade-in">
                      <div className="relative">
                        <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required={wantsPasswordReset}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new strong password"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {wantsPasswordReset ? 'Verify OTP & Reset Password' : 'Verify & Unlock Dashboard'}
                </button>
              </form>
            )}

            {/* Back to Password Login */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setErrorMessage('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Username &amp; Password
              </button>
            </div>
          </div>
        )}

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
