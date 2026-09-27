import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, KeyRound, Mail, ArrowRight, MessageCircle, AlertCircle, Lock, ShieldAlert } from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../lib/rateLimit';

export const MerchantLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rate Limiting State (5 attempts -> 90s lockout)
  const [clientIp, setClientIp] = useState<string>('detecting');
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const { login } = useMerchantAuth();
  const navigate = useNavigate();

  // 1. Fetch Client IP on mount
  useEffect(() => {
    async function initIp() {
      const ip = await getClientIp();
      setClientIp(ip);
      const state = checkRateLimit('merchant', ip);
      if (state.isBlocked) {
        setIsBlocked(true);
        setRemainingSeconds(state.remainingSeconds);
      }
    }
    initIp();
  }, []);

  // 2. Active Countdown Timer for 90s Lockout
  useEffect(() => {
    if (!isBlocked || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsBlocked(false);
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isBlocked, remainingSeconds]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const res = await login(email, pin);
    setLoading(false);

    if (res.success) {
      resetRateLimit('merchant', clientIp);
      navigate('/merchant/dashboard');
    } else {
      // Record failed attempt
      const rateState = recordFailedAttempt('merchant', clientIp);
      if (rateState.isBlocked) {
        setIsBlocked(true);
        setRemainingSeconds(rateState.remainingSeconds);
        setErrorMessage(
          `Security lockout: 5 consecutive incorrect login attempts from IP (${clientIp}). Access is temporarily blocked for ${rateState.remainingSeconds} seconds.`
        );
      } else {
        const attemptsLeft = 5 - rateState.attempts;
        setErrorMessage(
          `${res.error || 'Login failed. Please check your credentials.'} (Attempt ${rateState.attempts} of 5. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before 90s block)`
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-brand flex items-center justify-center text-white shadow-xl shadow-teal-brand/20">
          <Sparkles className="w-8 h-8 text-coral-brand" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">
          Merchant Login
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign in with your Email and Admin-provided secure PIN
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-card rounded-2xl border border-slate-200 sm:px-10 space-y-6">

          {/* Blocked Notification Banner */}
          {isBlocked ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-red-800">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <span>Login Temporarily Blocked (90s)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Too many failed login attempts detected from IP <strong className="font-mono text-red-900">{clientIp}</strong>. For security, merchant access is locked for <strong>{remainingSeconds} seconds</strong>.
              </p>
              <div className="pt-1 flex items-center gap-2 font-mono font-bold text-red-800 text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Unlocking in: {remainingSeconds}s</span>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Merchant Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={isBlocked}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@yourshop.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none text-slate-900 font-medium disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin-Provisioned Login PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  disabled={isBlocked}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none text-slate-900 font-mono font-bold tracking-widest disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Your PIN was generated by the Won More Admin upon WhatsApp onboarding.
              </p>
            </div>

            {/* Submit / Blocked Button */}
            {isBlocked ? (
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600/90 text-white text-xs font-bold rounded-xl shadow-md cursor-not-allowed transition"
              >
                <Lock className="w-4 h-4" />
                <span>Blocked: Retry in {remainingSeconds}s</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-coral-brand hover:bg-coral-hover text-white text-xs font-bold rounded-xl shadow-md shadow-coral-brand/20 transition disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Merchant Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* WhatsApp Support Notice */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Need to create a new shop account or forgot your PIN?
            </p>
            <a
              href="https://wa.me/15551234567?text=Hello%20Won%20More!%20I%20want%20to%20subscribe%20my%20shop%20to%20Scratch%20%26%20Win."
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Contact Admin on WhatsApp</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};
