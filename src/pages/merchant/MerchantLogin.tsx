import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, KeyRound, Mail, ArrowRight, MessageCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { clearAllStoredRateLimits, getClientIp } from '../../lib/rateLimit';
import { checkMerchantEmailExists } from '../../lib/supabase';

export const MerchantLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rate Limiting State
  const [clientIp, setClientIp] = useState<string>('detecting');
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const { login } = useMerchantAuth();
  const navigate = useNavigate();

  // 1. Purge any stale client-side lockouts on mount and detect IP
  useEffect(() => {
    clearAllStoredRateLimits();
    setIsBlocked(false);
    setRemainingSeconds(0);

    async function initIp() {
      const ip = await getClientIp();
      setClientIp(ip);
    }
    initIp();
  }, []);

  // 2. Active Countdown Timer for Lockout
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

  // Fast email existence check on blur
  const handleEmailBlur = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail && cleanEmail.includes('@')) {
      const exists = await checkMerchantEmailExists(cleanEmail);
      if (!exists) {
        setErrorMessage('This email ID is not registered in our merchant list. Please check your email address.');
      } else if (errorMessage?.includes('not registered')) {
        setErrorMessage(null);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanEmail || !cleanPin) {
      setErrorMessage('Please enter both your email address and PIN.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Verify email existence first
    const exists = await checkMerchantEmailExists(cleanEmail);
    if (!exists) {
      setLoading(false);
      setErrorMessage('This email ID is not registered in our merchant list. Please check your email address.');
      return;
    }

    const res = await login(cleanEmail, cleanPin);
    setLoading(false);

    if (res.success) {
      clearAllStoredRateLimits();
      navigate('/merchant/dashboard');
    } else {
      if (res.email_not_found) {
        setErrorMessage('This email ID is not registered in our merchant list. Please check your email address.');
      } else if (res.is_blocked) {
        setIsBlocked(true);
        setRemainingSeconds(res.remaining_seconds || 90);
        setErrorMessage(
          `Security lockout: 5 consecutive incorrect PIN attempts. Access is locked for ${res.remaining_seconds || 90} seconds.`
        );
      } else {
        setErrorMessage(res.error || 'Incorrect PIN. Please enter the valid PIN provided by Admin.');
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

          {/* Blocked or Error Notification Banner */}
          {isBlocked ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-red-800">
                <Lock className="w-4 h-4 text-red-600 shrink-0" />
                <span>Login Temporarily Locked (90s)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-700">
                5 consecutive incorrect PIN attempts detected. For security, please wait <strong>{remainingSeconds} seconds</strong> before retrying.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onBlur={handleEmailBlur}
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
                  type={showPin ? 'text' : 'password'}
                  required
                  disabled={isBlocked}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter 6-digit PIN"
                  className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none text-slate-900 font-mono font-bold tracking-widest disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
