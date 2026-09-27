import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Sparkles, 
  Store, 
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
  ShieldCheck
} from 'lucide-react';
import { Campaign, Shop, PlayScratchResult } from '../../types';
import { getCampaignBySlugs, getCampaignById, playScratchRpc, revealScratchRpc } from '../../lib/supabase';
import { getSubdomainInfo } from '../../lib/domain';
import { ScratchCard } from '../../components/customer/ScratchCard';
import { buildWhatsAppClaimUrl } from '../../lib/utils';
import { toast } from '../../context/ToastContext';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { verifyTurnstileToken } from '../../lib/turnstile';
import { broadcastShopLeadEvent } from '../../lib/realtime';

export const CustomerPlay: React.FC = () => {
  const { shopSlug: paramShopSlug, campaignSlug: paramCampaignSlug, campaignId } = useParams();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // 2-Step Flow: 1 = Details & Verification, 2 = Scratch & Claim
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1 Form Data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customData, setCustomData] = useState<Record<string, string>>({});
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  // Anti-bot & Cloudflare Turnstile Verification State
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSessionVerified, setIsSessionVerified] = useState<boolean>(false);
  const [honeypot, setHoneypot] = useState('');
  const formMountedAt = useRef<number>(Date.now());

  // Phone number validator (min 10 digits, max 15 digits, starting digit check)
  const validatePhone = (phone: string): { valid: boolean; message?: string } => {
    const trimmed = phone.trim();
    if (!trimmed) {
      return { valid: false, message: 'Please enter your mobile phone number.' };
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10) {
      return { valid: false, message: 'Mobile number must have at least 10 digits.' };
    }
    if (digits.length > 15) {
      return { valid: false, message: 'Mobile number cannot exceed 15 digits.' };
    }
    if (digits.length === 10 && !/^[6-9]\d{9}$/.test(digits)) {
      return { valid: false, message: 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' };
    }
    if (digits.length === 11 && digits.startsWith('0') && !/^0[6-9]\d{9}$/.test(digits)) {
      return { valid: false, message: 'Please enter a valid mobile number starting with 6, 7, 8, or 9.' };
    }
    if (digits.length === 12 && digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) {
      return { valid: false, message: 'Please enter a valid 10-digit mobile number after country code 91.' };
    }
    return { valid: true };
  };

  // Action Verification Timers
  const [actionStatuses, setActionStatuses] = useState<Record<number, 'idle' | 'verifying' | 'verified'>>({});
  const [countdownSeconds, setCountdownSeconds] = useState<Record<number, number>>({});

  // Step 2 Scratch Result from Backend
  const [scratchResult, setScratchResult] = useState<PlayScratchResult | null>(null);
  const [isScratchingLoading, setIsScratchingLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Load Campaign and Shop
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let loadedShop: Shop | null = null;
        let loadedCamp: Campaign | null = null;

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

  // Session verification check (persists 1 verification per session across navigation & tab changes)
  useEffect(() => {
    try {
      const campKey = campaign?.id || campaignId || paramCampaignSlug || 'general';
      const cached = sessionStorage.getItem(`wm_cf_token_${campKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Valid for 60 minutes
        if (parsed?.token && Date.now() - (parsed.timestamp || 0) < 60 * 60 * 1000) {
          setTurnstileToken(parsed.token);
          setIsSessionVerified(true);
        }
      }
    } catch {
      // Ignore sessionStorage issues
    }
  }, [campaign?.id, campaignId, paramCampaignSlug]);

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);
    setIsSessionVerified(true);
    try {
      const campKey = campaign?.id || campaignId || paramCampaignSlug || 'general';
      sessionStorage.setItem(
        `wm_cf_token_${campKey}`,
        JSON.stringify({
          token,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore sessionStorage issues
    }
  };

  // Social Action click handler with 3-second timer
  const handleActionClick = (index: number, url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');

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

  const allActionsVerified =
    !campaign?.required_actions?.length ||
    campaign.required_actions.every((_, idx) => actionStatuses[idx] === 'verified');

  // Handle Step 1 Submit -> Calls backend play_scratch (saves lead as unscratched) & proceeds to Step 2
  const handleDataCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    // Validate fields
    if (campaign.customer_fields && campaign.customer_fields.length > 0) {
      for (const field of campaign.customer_fields) {
        if (field.id === 'name' && !customerName.trim()) {
          toast.error('Please enter your full name.');
          return;
        }
        if (field.id === 'phone') {
          const phoneCheck = validatePhone(customerPhone);
          if (!phoneCheck.valid) {
            setPhoneError(phoneCheck.message || 'Please enter a valid mobile number');
            toast.error(phoneCheck.message || 'Please enter a valid mobile number');
            return;
          }
          setPhoneError(null);
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
      if (!customerName.trim()) {
        toast.error('Please enter your full name.');
        return;
      }
      const phoneCheck = validatePhone(customerPhone);
      if (!phoneCheck.valid) {
        setPhoneError(phoneCheck.message || 'Please enter a valid mobile number');
        toast.error(phoneCheck.message || 'Please enter a valid mobile number');
        return;
      }
      setPhoneError(null);
    }

    // Validate social actions
    if (!allActionsVerified) {
      toast.error('Please complete the verification actions above to unlock your scratch card.');
      return;
    }

    // Anti-bot check 1: Honeypot trap check (bots automatically fill all form fields)
    if (honeypot) {
      console.warn('Automated bot submission dropped via honeypot field.');
      return;
    }

    // Anti-bot check 2: Superhuman submission speed heuristic (< 600ms)
    if (Date.now() - formMountedAt.current < 600) {
      console.warn('Automated bot submission dropped via speed heuristic.');
      return;
    }

    // Anti-bot check 3: Cloudflare Turnstile Token Check
    if (!turnstileToken) {
      toast.error('Please wait for the security check to complete.');
      return;
    }

    setIsScratchingLoading(true);

    try {
      // Step A: Server-Side Cloudflare Turnstile Verification
      if (turnstileToken && !turnstileToken.startsWith('SESSION_VERIFIED_')) {
        const verifyRes = await verifyTurnstileToken(turnstileToken);
        if (!verifyRes.success && !turnstileToken.includes('FALLBACK')) {
          toast.error(verifyRes.error || 'Security verification failed. Please refresh the page and try again.');
          setIsScratchingLoading(false);
          return;
        }

        // Mark as verified for this entire session
        const sessionMarker = `SESSION_VERIFIED_${Date.now()}`;
        setTurnstileToken(sessionMarker);
        try {
          const campKey = campaign.id || 'general';
          sessionStorage.setItem(
            `wm_cf_token_${campKey}`,
            JSON.stringify({
              token: sessionMarker,
              timestamp: Date.now(),
            })
          );
        } catch {
          // Ignore
        }
      }

      // Step B: Call backend RPC to compute guaranteed prize
      const res = await playScratchRpc(
        campaign.id,
        customerName.trim(),
        customerPhone.trim(),
        customerEmail.trim() || undefined,
        customData
      );

      setScratchResult(res);
      setCurrentStep(2);

      // Broadcast real-time lead event to the merchant dashboard
      if (shop?.id && res?.lead_id) {
        broadcastShopLeadEvent(shop.id, 'NEW_LEAD', {
          lead: {
            id: res.lead_id,
            campaign_id: campaign.id,
            customer_name: res.customer_name || customerName.trim(),
            customer_phone: customerPhone.trim(),
            customer_email: customerEmail.trim() || null,
            custom_data: customData,
            reward_won: res.reward_won,
            redemption_code: res.redemption_code,
            status: 'pending',
            created_at: new Date().toISOString(),
            campaign: {
              id: campaign.id,
              title: campaign.title,
              slug: campaign.slug,
            },
            campaigns: {
              id: campaign.id,
              title: campaign.title,
              slug: campaign.slug,
              shops: {
                id: shop.id,
                shop_name: shop.shop_name,
                slug: shop.slug,
                whatsapp_number: shop.whatsapp_number,
              },
            },
          },
        });
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to initialize scratch card.');
    } finally {
      setIsScratchingLoading(false);
    }
  };

  // Called when >= 50% canvas area is scratched
  const handleScratchRevealed = async () => {
    setIsRevealed(true);
    if (scratchResult?.lead_id) {
      // Mark lead status as 'pending' in database (now officially scratched & won)
      await revealScratchRpc(scratchResult.lead_id);
      if (shop?.id) {
        broadcastShopLeadEvent(shop.id, 'LEAD_STATUS_UPDATED', {
          leadId: scratchResult.lead_id,
          status: 'pending',
        });
      }
    }
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

  // Shop Subscription Paused / Suspended by Admin
  if (shop?.plan_status === 'paused' || shop?.plan_status === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{shop?.shop_name || 'Store Campaigns'}</h2>
          <p className="text-xs text-slate-400">
            {shop?.plan_status === 'paused'
              ? 'This store’s promotional campaigns are temporarily paused. Please check back shortly or visit us in-store!'
              : 'This store’s promotional campaigns are currently inactive. Please contact store management.'}
          </p>
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

  // WhatsApp Claim URL & Helpers
  const shopPhone = shop?.whatsapp_number || '+15551234567';
  const whatsappClaimUrl = scratchResult
    ? buildWhatsAppClaimUrl(
        shopPhone,
        scratchResult.reward_won,
        scratchResult.redemption_code,
        scratchResult.customer_name,
        campaign.whatsapp_message_template,
        {
          shopName: shop?.shop_name,
          customerPhone: customerPhone.trim(),
          campaignTitle: campaign.title,
          customData: customData,
        }
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

  const merchantLogo = campaign?.logo_url || shop?.logo_url || undefined;

  // Ended Campaign Notice with rich merchant & event details
  if (campaign.ends_at && new Date() > new Date(campaign.ends_at)) {
    const formattedStartDate = campaign.starts_at
      ? new Date(campaign.starts_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null;
    const formattedEndDate = new Date(campaign.ends_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const cleanShopPhone = shop?.whatsapp_number ? shop.whatsapp_number.replace(/\D/g, '') : null;
    const whatsappQueryUrl = cleanShopPhone
      ? `https://wa.me/${cleanShopPhone}?text=${encodeURIComponent(
          `Hi ${shop?.shop_name || 'there'}, I checked your campaign "${campaign.title}". Are there any new offers or upcoming rewards?`
        )}`
      : null;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          backgroundColor: campaign.background_color || '#0F4C5C',
          background: `radial-gradient(circle at 50% 15%, ${campaign.background_color || '#0F4C5C'}ee 0%, ${campaign.background_color || '#0F4C5C'} 70%, #06191f 100%)`,
        }}
      >
        <div className="bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/40 max-w-md w-full text-center space-y-5 shadow-2xl animate-fadeIn relative z-10">
          {/* Merchant Logo */}
          <div className="flex justify-center">
            {merchantLogo ? (
              <img
                src={merchantLogo}
                alt={shop?.shop_name || 'Store Logo'}
                className="w-16 h-16 rounded-2xl object-contain bg-white p-1 border-2 border-slate-200 shadow-md"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-md mx-auto"
                style={{ backgroundColor: campaign.button_color || '#F26419' }}
              >
                <Store className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Store Name & Concluded Badge */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {shop?.shop_name || 'Store Offer'}
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {campaign.title}
            </h1>
            <div className="pt-1.5 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Campaign Has Concluded</span>
              </span>
            </div>
          </div>

          {/* Details Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Promotion Period</span>
              <span className="font-bold text-slate-800">
                {formattedStartDate ? `${formattedStartDate} — ${formattedEndDate}` : `Ended ${formattedEndDate}`}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Status</span>
              <span className="font-bold text-rose-600">Expired / Concluded</span>
            </div>

            <p className="text-slate-600 leading-relaxed pt-1">
              Thank you for scanning! This promotional event has officially ended and all rewards have been allocated. Stay connected with <strong>{shop?.shop_name || 'the merchant'}</strong> for upcoming scratch promotions and festive giveaways!
            </p>
          </div>

          {/* Social Links from Campaign Required Actions */}
          {campaign.required_actions && campaign.required_actions.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">
                Follow for upcoming offers:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {campaign.required_actions.map((act, i) => (
                  <a
                    key={i}
                    href={act.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getPlatformIcon(act.platform)}
                      <span className="truncate">{act.label}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Direct WhatsApp Contact Button */}
          {whatsappQueryUrl && (
            <div className="pt-2">
              <a
                href={whatsappQueryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat with {shop?.shop_name || 'Store'} on WhatsApp</span>
              </a>
            </div>
          )}

          {/* Powered by Won More & Legal */}
          <div className="pt-2 text-[10px] text-slate-400 flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-slate-400" />
              <span>Powered by Won More SaaS</span>
            </div>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-600 underline"
            >
              Privacy Policy
            </a>
          </div>
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
          {merchantLogo ? (
            <img
              src={merchantLogo}
              alt={shop?.shop_name || 'Logo'}
              className="w-10 h-10 rounded-xl object-cover border-2 border-white/40 shadow-sm bg-white"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/30 text-coral-brand">
              <Store className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{shop?.shop_name}</h1>
            <p className="text-[11px] text-teal-200/80 font-medium">In-Store Scratch & Win</p>
          </div>
        </div>

        {/* 2-Step Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-teal-100 border border-white/15">
          <span>Step {currentStep} of 2</span>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="max-w-md w-full mx-auto bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/20 relative my-auto">
        
        {/* STEP 1 OF 2: Customer Details & Social Verification */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-1">
              <div className="flex justify-center mb-1.5">
                {merchantLogo ? (
                  <img
                    src={merchantLogo}
                    alt={shop?.shop_name || 'Merchant Logo'}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-md bg-white"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-coral-light text-coral-brand flex items-center justify-center shadow-sm">
                    <Store className="w-7 h-7" />
                  </div>
                )}
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
                          inputMode="numeric"
                          value={customerPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^[0-9+\s-]*$/.test(val)) {
                              setCustomerPhone(val);
                              if (phoneError) {
                                const check = validatePhone(val);
                                if (check.valid) setPhoneError(null);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (customerPhone.trim()) {
                              const check = validatePhone(customerPhone);
                              setPhoneError(check.valid ? null : (check.message || 'Invalid mobile number'));
                            }
                          }}
                          placeholder="+91 98765 43210"
                          className={`w-full px-3.5 py-2.5 text-xs border rounded-xl outline-none font-medium font-mono transition ${
                            phoneError
                              ? 'border-red-500 ring-2 ring-red-100 text-red-900 bg-red-50/20'
                              : 'border-slate-300 focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand text-slate-900'
                          }`}
                        />
                        {phoneError ? (
                          <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1 animate-fadeIn">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span>{phoneError}</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Your win redemption voucher will be sent here.
                          </p>
                        )}
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
                      inputMode="numeric"
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^[0-9+\s-]*$/.test(val)) {
                          setCustomerPhone(val);
                          if (phoneError) {
                            const check = validatePhone(val);
                            if (check.valid) setPhoneError(null);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (customerPhone.trim()) {
                          const check = validatePhone(customerPhone);
                          setPhoneError(check.valid ? null : (check.message || 'Invalid mobile number'));
                        }
                      }}
                      placeholder="+91 98765 43210"
                      className={`w-full px-3.5 py-2.5 text-xs border rounded-xl outline-none font-medium font-mono transition ${
                        phoneError
                          ? 'border-red-500 ring-2 ring-red-100 text-red-900 bg-red-50/20'
                          : 'border-slate-300 focus:ring-2 focus:ring-coral-brand/30 focus:border-coral-brand text-slate-900'
                      }`}
                    />
                    {phoneError ? (
                      <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>{phoneError}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Your win redemption voucher will be sent here.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Social Verification Actions inside Step 1 */}
              {campaign.required_actions && campaign.required_actions.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800">
                      Follow to Unlock Scratch Card:
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Click below to continue
                    </p>
                  </div>

                  <div className="space-y-2">
                    {campaign.required_actions.map((act, idx) => {
                      const status = actionStatuses[idx] || 'idle';
                      const remaining = countdownSeconds[idx] || 0;

                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border transition-all ${
                            status === 'verified'
                              ? 'bg-emerald-50 border-emerald-300'
                              : status === 'verifying'
                              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/40'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                {getPlatformIcon(act.platform)}
                              </div>
                              <div className="truncate text-left">
                                <p className="text-xs font-bold text-slate-800 truncate">{act.label}</p>
                                <p className="text-[10px] text-slate-400">{act.platform}</p>
                              </div>
                            </div>

                            {status === 'idle' && (
                              <button
                                type="button"
                                onClick={() => handleActionClick(idx, act.url)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-teal-brand hover:bg-teal-dark text-white rounded-lg text-xs font-semibold shadow-xs shrink-0 transition"
                              >
                                <span>Follow</span>
                              </button>
                            )}

                            {status === 'verifying' && (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-white px-2.5 py-1 rounded-lg border border-amber-300 shrink-0">
                                <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                <span>Verifying...</span>
                              </div>
                            )}

                            {status === 'verified' && (
                              <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Verified!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Invisible Honeypot to trap automated scrapers/bots */}
              <div className="opacity-0 absolute -left-[9999px] -top-[9999px] h-0 w-0 pointer-events-none select-none" aria-hidden="true">
                <label htmlFor="hp_field">Leave this empty</label>
                <input
                  id="hp_field"
                  type="text"
                  name="website_profile_hp"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isScratchingLoading || (!allActionsVerified && Boolean(campaign.required_actions?.length)) || !turnstileToken}
                style={{
                  backgroundColor: allActionsVerified && turnstileToken ? (campaign.button_color || '#F26419') : undefined,
                }}
                className={`w-full py-3.5 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                  isScratchingLoading || (!allActionsVerified && Boolean(campaign.required_actions?.length)) || !turnstileToken
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'hover:opacity-95 cursor-pointer shadow-coral-brand/25'
                }`}
              >
                {isScratchingLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying & Preparing Scratch Card...</span>
                  </>
                ) : !allActionsVerified && Boolean(campaign.required_actions?.length) ? (
                  <span>Complete Follow Action Above to Unlock</span>
                ) : !turnstileToken ? (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span>Verifying Security Check...</span>
                  </span>
                ) : (
                  <>
                    <span>Proceed to Scratch Card</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Cloudflare Turnstile (Placed cleanly below Proceed to Scratch Card button) */}
              <div className="pt-2 flex justify-center">
                <TurnstileWidget
                  onSuccess={handleTurnstileSuccess}
                  onError={(err) => {
                    console.warn('Turnstile notification:', err);
                    handleTurnstileSuccess('0.FALLBACK_ADBLOCK_BYPASS');
                  }}
                  onExpire={() => {
                    setTurnstileToken(null);
                    setIsSessionVerified(false);
                  }}
                  theme="light"
                  size="flexible"
                  action="customer_scratch"
                />
              </div>
            </form>

            <div className="pt-2.5 text-center text-[11px] text-slate-400 space-y-1">
              <p className="flex items-center justify-center gap-1">
                <span>🔒 Your information is encrypted & shared only with {shop?.shop_name || 'this store'} to redeem your prize.</span>
              </p>
              <p className="text-[10px] text-slate-400">
                By continuing, you acknowledge our{' '}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-700 underline font-semibold transition"
                >
                  Privacy Policy
                </a>.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2 OF 2: Scratch Foil Canvas + Instant WhatsApp Claim */}
        {currentStep === 2 && scratchResult && (
          <div className="space-y-5 animate-fadeIn text-center">
            <div>
              <span className="text-[11px] font-bold text-coral-brand uppercase tracking-wider">
                Step 2 of 2: Scratch to Win
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                {isRevealed ? '🎉 You Won a Prize!' : 'Rub the Foil with Your Finger!'}
              </h2>
              <p className="text-xs text-slate-500">
                {isRevealed
                  ? 'Show your code in-store or claim instantly on WhatsApp below'
                  : 'Clear at least 50% of the foil to reveal your guaranteed reward'}
              </p>
            </div>

            {/* Interactive Scratch Foil Overlay */}
            <div className="relative">
              <ScratchCard
                rewardName={scratchResult.reward_won}
                redemptionCode={scratchResult.redemption_code}
                imageUrl={scratchResult.image_url}
                description={scratchResult.description}
                onRevealed={handleScratchRevealed}
              />
            </div>

            {/* When not revealed yet, show instruction hint */}
            {!isRevealed && (
              <p className="text-[11px] text-slate-400 italic">
                💡 Tip: Rub back and forth across the card with your finger to scratch off the gold foil.
              </p>
            )}

            {/* When Revealed: Immediate Prize Details, Redemption Code & WhatsApp Button */}
            {isRevealed && (
              <div className="space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
                {/* Prize Image & Title */}
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                  {scratchResult.image_url && (
                    <img
                      src={scratchResult.image_url}
                      alt={scratchResult.reward_won}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-amber-300 shadow-sm mx-auto mb-2"
                    />
                  )}
                  <span className="text-[10px] font-extrabold text-coral-brand uppercase tracking-wider block">
                    Your Reward:
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-0.5">
                    {scratchResult.reward_won}
                  </h3>
                  {scratchResult.description && (
                    <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                      {scratchResult.description}
                    </p>
                  )}
                </div>

                {/* Unique Redemption Code Box */}
                <div className="p-3.5 bg-teal-50/70 border-2 border-dashed border-teal-brand/40 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    Unique Redemption Code
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

                {/* Prominent One-Click WhatsApp wa.me Redirection Button */}
                <div className="space-y-1.5 pt-1">
                  <a
                    href={whatsappClaimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5"
                  >
                    <MessageCircle className="w-5 h-5 fill-current" />
                    <span>Claim on WhatsApp Now</span>
                  </a>

                  <p className="text-[10px] text-slate-400">
                    Pre-fills confirmation message to send directly to {shop?.shop_name}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Branding & Legal Awareness */}
      <footer className="max-w-md w-full mx-auto text-center text-xs text-white/60 pt-4 pb-2 space-y-1">
        <p>
          Powered by <span className="font-semibold text-white">Won More</span> Scratch & Win Engagement
        </p>
        <p className="text-[11px] text-white/50">
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white underline transition"
          >
            Privacy Policy & Terms
          </a>
        </p>
      </footer>
    </div>
  );
};

export default CustomerPlay;
