import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Sparkles, 
  Store, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Gift, 
  MessageCircle, 
  ArrowRight, 
  Copy, 
  Check, 
  Instagram, 
  MapPin, 
  Facebook, 
  Globe, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Campaign, Shop, PlayScratchResult, RequiredAction } from '../../types';
import { getCampaignBySlugs, getCampaignById, playScratchRpc } from '../../lib/supabase';
import { getSubdomainInfo } from '../../lib/domain';
import { ScratchCard } from '../../components/customer/ScratchCard';
import { buildWhatsAppClaimUrl } from '../../lib/utils';
import { toast } from '../../context/ToastContext';

export const CustomerPlay: React.FC = () => {
  const { shopSlug: paramShopSlug, campaignSlug: paramCampaignSlug, campaignId } = useParams<{
    shopSlug?: string;
    campaignSlug?: string;
    campaignId?: string;
  }>();

  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // Flow Steps: 1 = Data Capture, 2 = Social Actions, 3 = Scratch Card, 4 = Prize Claim
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 Form Data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customData, setCustomData] = useState<Record<string, string>>({});

  // Step 2 Action Verification Timers
  // Tracks status per action: 'idle' | 'verifying' | 'verified'
  const [actionStatuses, setActionStatuses] = useState<Record<number, 'idle' | 'verifying' | 'verified'>>({});
  const [countdownSeconds, setCountdownSeconds] = useState<Record<number, number>>({});

  // Step 3 Scratch Result from Backend
  const [scratchResult, setScratchResult] = useState<PlayScratchResult | null>(null);
  const [isScratchingLoading, setIsScratchingLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  // Step 4 Copy State
  const [copiedCode, setCopiedCode] = useState(false);

  // Load Campaign and Shop
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let loadedShop: Shop | null = null;
        let loadedCamp: Campaign | null = null;

        // Check subdomain first if not explicit in path
        const subInfo = getSubdomainInfo();
        const effectiveShopSlug = paramShopSlug || (subInfo.isSubdomain ? subInfo.shopSlug : null);
        const effectiveCampSlug = paramCampaignSlug || searchParams.get('c') || 'rewards';

        if (campaignId) {
          loadedCamp = await getCampaignById(campaignId);
          loadedShop = loadedCamp.shops || null;
        } else if (effectiveShopSlug && effectiveCampSlug) {
          const res = await getCampaignBySlugs(effectiveShopSlug, effectiveCampSlug);
          loadedShop = res.shop;
          loadedCamp = res.campaign;
        } else {
          // Fallback to default demo shop
          const res = await getCampaignBySlugs('urban-roast', 'grand-opening');
          loadedShop = res.shop;
          loadedCamp = res.campaign;
        }

        if (!loadedCamp) {
          throw new Error('Campaign not found.');
        }

        setShop(loadedShop);
        setCampaign(loadedCamp);

        // Initialize action verification map
        const initialMap: Record<number, 'idle' | 'verifying' | 'verified'> = {};
        loadedCamp.required_actions?.forEach((_, idx) => {
          initialMap[idx] = 'idle';
        });
        setActionStatuses(initialMap);
      } catch (err: unknown) {
        setError((err as Error).message || 'Unable to load campaign.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [paramShopSlug, paramCampaignSlug, campaignId]);

  // Handle Step 1 Submit -> Proceed to Step 2 (or Step 3 if no actions required)
  const handleDataCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate based on campaign.customer_fields if configured
    if (campaign?.customer_fields && campaign.customer_fields.length > 0) {
      for (const field of campaign.customer_fields) {
        if (field.id === 'name' && !customerName.trim()) {
          toast.error('Please enter your full name.');
          return;
        }
        if (field.id === 'phone' && !customerPhone.trim()) {
          toast.error('Please enter your WhatsApp phone number.');
          return;
        }
        if (field.id === 'email' && field.required && !customerEmail.trim()) {
          toast.error('Please enter your email address.');
          return;
        }
        if (field.id !== 'name' && field.id !== 'phone' && field.id !== 'email' && field.required) {
          if (!customData[field.id]?.trim()) {
            toast.error(`Please enter ${field.label}.`);
            return;
          }
        }
      }
    } else {
      if (!customerName.trim() || !customerPhone.trim()) {
        toast.error('Please enter your name and phone number.');
        return;
      }
    }

    if (!campaign?.required_actions || campaign.required_actions.length === 0) {
      // Skip directly to scratch card preparation
      prepareScratch();
    } else {
      setCurrentStep(2);
    }
  };

  /**
   * Step 2: Crucial Action Verification Logic
   * Clicking an action button opens the URL in a new tab AND triggers a hidden 3-second timer (setTimeout)
   * The final "Submit & Scratch" button remains visually disabled until all timers finish.
   */
  const handleActionClick = (index: number, url: string) => {
    // 1. Open destination URL in a new tab
    window.open(url, '_blank', 'noopener,noreferrer');

    // 2. Start 3-second psychological verification timer
    setActionStatuses(prev => ({ ...prev, [index]: 'verifying' }));
    setCountdownSeconds(prev => ({ ...prev, [index]: 3 }));

    let remaining = 3;
    const interval = setInterval(() => {
      remaining -= 1;
      setCountdownSeconds(prev => ({ ...prev, [index]: remaining }));

      if (remaining <= 0) {
        clearInterval(interval);
        setActionStatuses(prev => ({ ...prev, [index]: 'verified' }));
      }
    }, 1000);
  };

  // Check if all required actions are verified
  const allActionsVerified =
    !campaign?.required_actions?.length ||
    campaign.required_actions.every((_, idx) => actionStatuses[idx] === 'verified');

  // Prepare Scratch: calls backend play_scratch RPC to calculate prize
  const prepareScratch = async () => {
    if (!campaign) return;
    setIsScratchingLoading(true);

    try {
      const res = await playScratchRpc(
        campaign.id,
        customerName.trim(),
        customerPhone.trim(),
        customerEmail.trim() || undefined,
        customData
      );

      setScratchResult(res);
      setCurrentStep(3);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to initialize scratch card.');
    } finally {
      setIsScratchingLoading(false);
    }
  };

  // Called when 50% canvas area is cleared
  const handleScratchRevealed = () => {
    setIsRevealed(true);
    // Delay slightly to let the user enjoy the celebration before displaying Step 4 prize details
    setTimeout(() => {
      setCurrentStep(4);
    }, 1800);
  };

  const handleCopyCode = () => {
    if (scratchResult?.redemption_code) {
      navigator.clipboard.writeText(scratchResult.redemption_code);
      setCopiedCode(true);
      toast.success('Redemption code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F4C5C] flex items-center justify-center p-4 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-coral-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide">Loading Scratch & Win experience...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-card border border-slate-200 max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-coral-brand mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Campaign Unavailable</h2>
          <p className="text-xs text-slate-500">{error || 'This campaign may be expired or temporarily paused.'}</p>
        </div>
      </div>
    );
  }

  // Paused Campaign Notice
  if (!campaign.is_active) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{campaign.title}</h2>
          <p className="text-xs text-slate-400">
            This Scratch & Win event is currently paused by {shop?.shop_name || 'the shop'}. Please check back shortly or ask the cashier!
          </p>
        </div>
      </div>
    );
  }

  // Scheduled / Starting Soon Notice
  if (campaign.starts_at && new Date() < new Date(campaign.starts_at)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{campaign.title}</h2>
          <p className="text-xs text-slate-300 font-medium">
            This Scratch & Win event starts on:
          </p>
          <div className="py-2 px-4 bg-slate-900/80 rounded-xl border border-slate-700 font-mono text-teal-300 text-sm font-semibold inline-block">
            {new Date(campaign.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          <p className="text-xs text-slate-400">
            Please check back then to participate and win exciting prizes from {shop?.shop_name || 'the store'}!
          </p>
        </div>
      </div>
    );
  }

  // Ended Campaign Notice
  if (campaign.ends_at && new Date() > new Date(campaign.ends_at)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{campaign.title}</h2>
          <p className="text-xs text-rose-300 font-medium">
            This Scratch & Win event has concluded.
          </p>
          <p className="text-xs text-slate-400">
            The promotion ended on {new Date(campaign.ends_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}. Stay tuned for upcoming events and offers from {shop?.shop_name || 'the store'}!
          </p>
        </div>
      </div>
    );
  }

  // Store Subscription Expired Notice
  if (shop?.subscription_expires_at && new Date() > new Date(shop.subscription_expires_at)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{campaign.title}</h2>
          <p className="text-xs text-slate-400">
            This Scratch & Win event is temporarily unavailable. Please inquire with {shop?.shop_name || 'the shop'} staff.
          </p>
        </div>
      </div>
    );
  }

  // Format WhatsApp Claim URL
  const shopPhone = shop?.whatsapp_number || '+15551234567';
  const whatsappClaimUrl = scratchResult
    ? buildWhatsAppClaimUrl(
        shopPhone,
        scratchResult.reward_won,
        scratchResult.redemption_code,
        scratchResult.customer_name
      )
    : '#';

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'google maps':
        return <MapPin className="w-4 h-4 text-emerald-500" />;
      case 'facebook':
        return <Facebook className="w-4 h-4 text-blue-500" />;
      default:
        return <Globe className="w-4 h-4 text-teal-brand" />;
    }
  };

  return (
    <div
      className="min-h-screen text-slate-800 flex flex-col justify-between p-4 sm:p-6 select-none transition-colors duration-300"
      style={{
        backgroundColor: campaign.background_color || '#0F4C5C',
      }}
    >
      
      {/* Top Header Bar */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between text-white/90 pt-2 pb-4">
        <div className="flex items-center gap-2.5">
          {(campaign.logo_url || shop?.logo_url) ? (
            <img
              src={campaign.logo_url || shop?.logo_url || ''}
              alt={shop?.shop_name || 'Logo'}
              className="w-10 h-10 rounded-full object-cover border-2 border-white/40 shadow-sm bg-white"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/30 text-coral-brand">
              <Store className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{shop?.shop_name}</h1>
            <p className="text-[11px] text-teal-200/80 font-medium">In-Store Scratch & Win</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-teal-100 border border-white/15">
          <span>Step {currentStep} of 4</span>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="max-w-md w-full mx-auto bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/20 relative my-auto">
        
        {/* STEP 1: Customer Data Capture */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-1">
              <div className="inline-flex p-2 rounded-2xl bg-coral-light text-coral-brand mb-1 shadow-sm">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {campaign.title}
              </h2>
              <p className="text-xs text-slate-500">
                Enter your details to unlock your instant Scratch & Win card!
              </p>
            </div>

            <form onSubmit={handleDataCaptureSubmit} className="space-y-3.5">
              {/* Dynamic Customer Fields */}
              {campaign.customer_fields && campaign.customer_fields.length > 0 ? (
                campaign.customer_fields.map((field) => {
                  if (field.id === 'name') {
                    return (
                      <div key={field.id}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {field.label} <span className="text-coral-brand">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Sarah Connor"
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium"
                        />
                      </div>
                    );
                  }

                  if (field.id === 'phone') {
                    return (
                      <div key={field.id}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {field.label} <span className="text-coral-brand">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium font-mono"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Your win redemption voucher will be sent here.
                        </p>
                      </div>
                    );
                  }

                  if (field.id === 'email') {
                    return (
                      <div key={field.id}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {field.label} {field.required && <span className="text-coral-brand">*</span>}
                        </label>
                        <input
                          type="email"
                          required={field.required}
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="sarah@example.com"
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium"
                        />
                      </div>
                    );
                  }

                  if (field.type === 'select' && field.options) {
                    return (
                      <div key={field.id}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {field.label} {field.required && <span className="text-coral-brand">*</span>}
                        </label>
                        <select
                          required={field.required}
                          value={customData[field.id] || ''}
                          onChange={(e) => setCustomData({ ...customData, [field.id]: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium bg-white"
                        >
                          <option value="">Select {field.label}...</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {field.label} {field.required && <span className="text-coral-brand">*</span>}
                      </label>
                      <input
                        type={field.type || 'text'}
                        required={field.required}
                        value={customData[field.id] || ''}
                        onChange={(e) => setCustomData({ ...customData, [field.id]: e.target.value })}
                        placeholder={field.placeholder || `Enter ${field.label}`}
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium"
                      />
                    </div>
                  );
                })
              ) : (
                /* Fallback default fields: Name + Phone */
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-coral-brand">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp Phone Number <span className="text-coral-brand">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Your win redemption voucher will be sent here.
                    </p>
                  </div>

                  {campaign.required_fields?.includes('email') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="sarah@example.com"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand outline-none text-slate-900 font-medium"
                      />
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                style={{ backgroundColor: campaign.button_color || '#F26419' }}
                className="w-full mt-2 py-3 text-white rounded-xl text-xs font-bold shadow-lg shadow-black/10 transition flex items-center justify-center gap-2 hover:opacity-95"
              >
                <span>Continue to Social Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-2 text-center text-[10px] text-slate-400">
              🔒 Your information is private & only shared with {shop?.shop_name}.
            </div>
          </div>
        )}

        {/* STEP 2: Social Actions & Psychological 3-Second Verification */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-bold text-coral-brand uppercase tracking-wider">
                Step 2 of 4
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Unlock Your Scratch Card
              </h2>
              <p className="text-xs text-slate-500">
                Complete the action below to verify and activate your scratch card.
              </p>
            </div>

            <div className="space-y-3">
              {campaign.required_actions?.map((act, idx) => {
                const status = actionStatuses[idx] || 'idle';
                const remaining = countdownSeconds[idx] || 0;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      status === 'verified'
                        ? 'bg-emerald-50 border-emerald-300'
                        : status === 'verifying'
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/40'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                          {getPlatformIcon(act.platform)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{act.label}</p>
                          <p className="text-[10px] text-slate-400">{act.platform}</p>
                        </div>
                      </div>

                      {/* Action Button / Verification Feedback */}
                      {status === 'idle' && (
                        <button
                          type="button"
                          onClick={() => handleActionClick(idx, act.url)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-brand hover:bg-teal-dark text-white rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          <span>Open & Follow</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {status === 'verifying' && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-white px-2.5 py-1 rounded-lg border border-amber-300">
                          <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                          <span>Verifying ({remaining}s)</span>
                        </div>
                      )}

                      {status === 'verified' && (
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Verified!</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submit & Scratch Button (Crucial Logic: visually disabled until 3s timer completes) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={prepareScratch}
                disabled={!allActionsVerified || isScratchingLoading}
                style={{
                  backgroundColor: allActionsVerified && !isScratchingLoading ? (campaign.button_color || '#F26419') : undefined,
                }}
                className={`w-full py-3.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2 ${
                  allActionsVerified && !isScratchingLoading
                    ? 'text-white shadow-coral-brand/30 cursor-pointer animate-pulse hover:opacity-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isScratchingLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Preparing Scratch Foil...</span>
                  </>
                ) : allActionsVerified ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>I've Followed! Scratch Card Now</span>
                  </>
                ) : (
                  <span>Click Follow Above to Unlock</span>
                )}
              </button>

              {!allActionsVerified && (
                <p className="text-[11px] text-center text-slate-400 mt-2">
                  ⏳ Action verification takes 3 seconds after opening the link.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: HTML5 Canvas Scratch Card & Haptics */}
        {currentStep === 3 && scratchResult && (
          <div className="space-y-5 animate-fadeIn text-center">
            <div>
              <span className="text-[11px] font-bold text-coral-brand uppercase tracking-wider">
                Step 3 of 4: Scratch Your Card
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                Rub the Foil with Your Finger!
              </h2>
              <p className="text-xs text-slate-500">
                Clear at least 50% of the card to reveal your instant prize
              </p>
            </div>

            {/* Interactive Scratch Foil Overlay */}
            <ScratchCard
              rewardName={scratchResult.reward_won}
              redemptionCode={scratchResult.redemption_code}
              imageUrl={scratchResult.image_url}
              description={scratchResult.description}
              onRevealed={handleScratchRevealed}
            />

            <p className="text-[11px] text-slate-400 italic">
              💡 Tip: Haptic vibration & sound effects are active.
            </p>
          </div>
        )}

        {/* STEP 4: Prize Claim & WhatsApp wa.me Redirection */}
        {currentStep === 4 && scratchResult && (
          <div className="space-y-5 animate-fadeIn text-center">
            {/* Prize Image or Celebration Badge */}
            {scratchResult.image_url ? (
              <div className="relative inline-block">
                <img
                  src={scratchResult.image_url}
                  alt={scratchResult.reward_won}
                  className="w-20 h-20 rounded-2xl object-cover border-3 border-coral-brand shadow-lg mx-auto"
                />
                <div className="absolute -top-2 -right-2 bg-coral-brand text-white p-1 rounded-full shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md">
                <Gift className="w-9 h-9 animate-bounce" />
              </div>
            )}

            <div>
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-coral-light text-coral-brand tracking-wider uppercase">
                🎉 PRIZE WON!
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
                {scratchResult.reward_won}
              </h2>
              {scratchResult.description && (
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  {scratchResult.description}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Congratulations, {scratchResult.customer_name}! Show this code to the cashier to redeem.
              </p>
            </div>

            {/* Unique Redemption Code Box */}
            <div className="p-4 bg-teal-50/70 border-2 border-dashed border-teal-brand/40 rounded-2xl space-y-1 relative">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                Your Unique Redemption Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-black text-teal-brand tracking-widest">
                  {scratchResult.redemption_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 hover:bg-teal-100 rounded-lg text-teal-brand transition"
                  title="Copy Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Crucial Logic: One-Click WhatsApp wa.me Redirection Button */}
            <div className="space-y-2 pt-2">
              <a
                href={whatsappClaimUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Claim on WhatsApp Now</span>
              </a>

              <p className="text-[11px] text-slate-400">
                Opens WhatsApp with pre-filled win confirmation message for the cashier.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Footer Branded Attribution */}
      <footer className="max-w-md w-full mx-auto text-center text-teal-200/50 text-[11px] pt-4">
        Powered by <span className="font-semibold text-white">Won More</span> • Scratch & Win Engagement
      </footer>

    </div>
  );
};
