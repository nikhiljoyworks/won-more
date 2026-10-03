import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, MessageCircle, Clock, Zap, Sparkles, AlertCircle } from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { useMerchantData } from '../../context/MerchantDataContext';
import { formatDate } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { SubscriptionPlan } from '../../types';

export const MerchantSubscription: React.FC = () => {
  const { shop } = useMerchantAuth();
  const { campaigns, telemetry, currentPlan: cachedPlan } = useMerchantData();
  const [dbPlans, setDbPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    // Fetch all subscription plans for the comparison grid
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDbPlans(data);
        }
      });
  }, []);

  const activeCampaignsCount = campaigns.filter(c => c.is_active && !c.is_archived).length;
  const totalLeadsCount = telemetry?.total_leads ?? 0;

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = getDaysRemaining(shop?.subscription_expires_at || null);
  const isExpired = shop?.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date();

  // Find currently subscribed plan in DB or fallback to context cachedPlan
  const currentPlan = dbPlans.find(
    p => p.slug.toLowerCase() === (shop?.plan_tier || '').toLowerCase()
  ) || cachedPlan;

  const defaultTiers = [
    {
      slug: 'starter',
      name: 'Starter',
      price: '₹999 / mo',
      campaignsLimit: 1,
      leadsLimit: 500,
      description: 'Ideal for single retail shops & pop-up stalls',
      features: ['1 Live Campaign', '500 Customer Leads', 'Standard QR Standee', 'Export Leads to CSV'],
      current: shop?.plan_tier === 'starter',
    },
    {
      slug: 'growth',
      name: 'Growth',
      price: '₹2,499 / mo',
      campaignsLimit: 5,
      leadsLimit: 2500,
      description: 'Best for active cafes, restaurants & retail stores',
      features: [
        '5 Active Campaigns',
        '2,500 Customer Leads',
        'Next Prize Override Controller',
        'Next 10 Prizes Preview',
        'Custom Social Action Timers',
        'Priority WhatsApp Support',
      ],
      current: shop?.plan_tier === 'growth',
    },
    {
      slug: 'pro',
      name: 'Pro Enterprise',
      price: '₹4,999 / mo',
      campaignsLimit: 999,
      leadsLimit: 10000,
      description: 'For multi-location franchises & high-volume retail',
      features: [
        'Unlimited Campaigns',
        '10,000+ Customer Leads',
        'Custom Background & Button Colors',
        'Custom Fields (DOB, Place)',
        'Custom Domain & Dedicated Links',
        'Dedicated 24/7 Account Manager',
      ],
      current: shop?.plan_tier === 'pro',
    },
  ];

  const displayTiers = dbPlans.length > 0
    ? dbPlans.map(p => ({
        slug: p.slug,
        name: p.name,
        price: `${p.currency === 'INR' ? '₹' : '$'}${p.price.toLocaleString()} / ${p.billing_interval}`,
        campaignsLimit: p.campaigns_limit,
        leadsLimit: p.leads_limit,
        description: `Up to ${p.campaigns_limit >= 999 ? 'Unlimited' : p.campaigns_limit} Campaigns • ${p.leads_limit >= 10000 ? 'Unlimited' : p.leads_limit.toLocaleString()} Leads`,
        features: Array.isArray(p.features) ? p.features : [],
        current: shop?.plan_tier?.toLowerCase() === p.slug.toLowerCase(),
      }))
    : defaultTiers;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Subscription & Plan Management</h2>
          <p className="text-xs text-slate-500">
            Transparent plan limits, live usage telemetry, and zero-maintenance concierge billing
          </p>
        </div>

        {/* Current Active Plan Card - Rich Detail Showcase */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-[#0F4C5C] text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Subtle background flair */}
          <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-coral-brand text-white shadow-sm">
                  Active Subscription
                </span>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  isExpired
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  ● {shop?.plan_status.toUpperCase()}
                </span>
              </div>

              <div>
                <h3 className="text-3xl font-extrabold capitalize text-white flex items-center gap-3">
                  {currentPlan ? currentPlan.name : `${shop?.plan_tier} Plan`}
                </h3>
                <p className="text-xs text-teal-100/80 pt-1">
                  Subscribed for <strong>{shop?.shop_name}</strong> (@{shop?.slug})
                </p>
              </div>

              {/* Live Quota Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10">
                  <span className="text-[10px] text-teal-200 uppercase font-semibold block">Live Campaigns</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-bold text-white">{activeCampaignsCount}</span>
                    <span className="text-xs text-teal-200/70">
                      / {currentPlan ? (currentPlan.campaigns_limit >= 999 ? '∞' : currentPlan.campaigns_limit) : 1}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10">
                  <span className="text-[10px] text-teal-200 uppercase font-semibold block">Captured Leads</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-bold text-white">{totalLeadsCount.toLocaleString()}</span>
                    <span className="text-xs text-teal-200/70">
                      / {currentPlan ? (currentPlan.leads_limit >= 10000 ? '∞' : currentPlan.leads_limit.toLocaleString()) : 500}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-teal-200 uppercase font-semibold block">Plan Validity</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-bold text-white">{daysRemaining}</span>
                    <span className="text-xs text-teal-200/70">days left</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-teal-200/70 flex items-center gap-1.5 pt-1">
                <Clock className="w-3.5 h-3.5 text-teal-300" />
                Valid through <span className="font-semibold text-white">{formatDate(shop?.subscription_expires_at)}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2.5 w-full sm:w-auto">
              <a
                href={`https://wa.me/919876543210?text=Hello%20Won%20More%20Admin!%20I%20would%20like%20to%20renew%20or%20upgrade%20the%20plan%20for%20${encodeURIComponent(shop?.shop_name || '')}%20(Current:%20${shop?.plan_tier})`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Renew / Extend Plan</span>
              </a>

              <a
                href={`https://wa.me/919876543210?text=Hello%20Won%20More%20Admin!%20I%20have%20a%20question%20regarding%20my%20plan%20quota%20for%20${encodeURIComponent(shop?.shop_name || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition"
              >
                <span>WhatsApp Concierge</span>
              </a>
            </div>
          </div>
        </div>

        {/* Plan Tiers Directory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Available Subscription Plans</h3>
            <span className="text-xs text-slate-500">Pick a plan to upgrade your campaign & lead limits</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayTiers.map((tier) => {
              const isCurrent = tier.current;

              return (
                <div
                  key={tier.slug}
                  className={`rounded-2xl p-6 border transition flex flex-col justify-between space-y-6 relative ${
                    isCurrent
                      ? 'bg-gradient-to-b from-teal-50/80 to-white border-teal-brand ring-2 ring-teal-brand/30 shadow-card'
                      : 'bg-white border-slate-200 shadow-soft hover:shadow-card'
                  }`}
                >
                  {/* Current Active Ribbon */}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-teal-brand text-white text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Your Current Plan</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between pt-1">
                      <h4 className="text-lg font-bold text-slate-900">{tier.name}</h4>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">{tier.price}</p>
                      <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                    </div>

                    {/* Quota Highlights Box */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1.5 font-medium text-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Active Campaigns:</span>
                        <strong className="text-teal-brand font-bold">
                          {tier.campaignsLimit >= 999 ? 'Unlimited' : `${tier.campaignsLimit} Active`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Lead Captures:</span>
                        <strong className="text-teal-brand font-bold">
                          {tier.leadsLimit >= 10000 ? 'Unlimited' : `${tier.leadsLimit.toLocaleString()} Leads`}
                        </strong>
                      </div>
                    </div>

                    <ul className="space-y-2 pt-1">
                      {tier.features.map((f, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={`https://wa.me/919876543210?text=Hello%20Won%20More%20Admin!%20I%20want%20to%20${isCurrent ? 'renew%20or%20manage' : 'upgrade%20to'}%20the%20${encodeURIComponent(tier.name)}%20plan%20for%20${encodeURIComponent(shop?.shop_name || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-2.5 rounded-xl text-xs font-bold text-center transition block shadow-sm ${
                      isCurrent
                        ? 'bg-teal-brand hover:bg-teal-dark text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {isCurrent ? 'Manage via WhatsApp' : `Upgrade to ${tier.name}`}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
};

