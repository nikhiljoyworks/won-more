import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Store, Gift, Zap, ArrowRight, ShieldCheck, QrCode, Smartphone, Users, TrendingUp } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-bg text-slate-800 flex flex-col justify-between selection:bg-coral-brand selection:text-white">
      
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-brand text-coral-brand flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl text-slate-900 tracking-tight leading-none block">
                Won More
              </span>
              <span className="text-[10px] text-teal-brand font-bold uppercase tracking-wider">
                Scratch & Win SaaS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/merchant-login"
              className="text-xs font-bold text-teal-brand hover:text-teal-dark px-3.5 py-2 rounded-xl border border-teal-brand/30 hover:bg-teal-50 transition"
            >
              Merchant Login
            </Link>
            <Link
              to="/urban-roast/grand-opening"
              className="flex items-center gap-1.5 px-4 py-2 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-md shadow-coral-brand/20 transition"
            >
              <span>Try Live Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 sm:py-24 space-y-20">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-brand/10 text-teal-brand border border-teal-brand/20">
            <Sparkles className="w-3.5 h-3.5 text-coral-brand" />
            <span>Turn Counter Visitors into Loyal Repeat Customers</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            The Interactive <span className="text-coral-brand">Scratch & Win</span> Platform for Modern Retail
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal">
            Place our printable QR standee at your counter. Customers scan, follow your Instagram or leave a Google review, and scratch to win instant prizes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/urban-roast/grand-opening"
              className="px-6 py-3.5 bg-coral-brand hover:bg-coral-hover text-white text-sm font-bold rounded-2xl shadow-xl shadow-coral-brand/30 transition transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>Experience Customer Scratch Demo</span>
            </Link>

            <Link
              to="/merchant-login"
              className="px-6 py-3.5 bg-teal-brand hover:bg-teal-dark text-white text-sm font-bold rounded-2xl shadow-lg transition flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              <span>Merchant Dashboard Login</span>
            </Link>
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-soft space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-brand/10 text-teal-brand flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Instant QR Counter Standee</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Generate branded A5 table tents and counter standees with dynamic QR codes. Customers simply scan using their native phone camera.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-soft space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-coral-light text-coral-brand flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Psychological Social Timer</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mandate an Instagram follow or 5-star Google review with an integrated 3-second verification countdown before unlocking the scratch foil.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-soft space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. Prize Pool Queue & Override</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Preview the next 10 upcoming prizes, or manually pin the exact reward for the next customer in your queue with one click.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400 space-y-2">
        <p>© 2026 Won More. All rights reserved. Zero server maintenance B2B2C architecture.</p>
        <p>
          <Link to="/privacy-policy" className="hover:text-slate-600 underline transition">
            Privacy Policy & Legal Terms
          </Link>
        </p>
      </footer>

    </div>
  );
};
