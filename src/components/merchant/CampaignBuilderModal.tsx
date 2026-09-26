import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Trash2, 
  Globe, 
  Instagram, 
  Facebook, 
  MapPin, 
  CheckCircle2, 
  Palette, 
  Store,
  Calendar,
  Layers,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { Campaign, RequiredAction, CustomerFieldConfig } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { formatDate } from '../../lib/utils';
import { toast } from '../../context/ToastContext';

interface CampaignBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  campaign?: Campaign | null;
  onSaved: () => Promise<void>;
}

// Preset color options
const BG_PRESETS = [
  { name: 'Dark Teal', hex: '#0F4C5C' },
  { name: 'Slate Midnight', hex: '#1E293B' },
  { name: 'Deep Indigo', hex: '#312E81' },
  { name: 'Charcoal Black', hex: '#111827' },
  { name: 'Forest Emerald', hex: '#064E3B' },
  { name: 'Royal Crimson', hex: '#831843' },
  { name: 'Warm Cream', hex: '#FAF8F5' },
];

const BUTTON_PRESETS = [
  { name: 'Vibrant Coral', hex: '#F26419' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Electric Blue', hex: '#2563EB' },
  { name: 'Purple Violet', hex: '#7C3AED' },
  { name: 'Rose Red', hex: '#E11D48' },
  { name: 'Amber Gold', hex: '#F59E0B' },
];

export const CampaignBuilderModal: React.FC<CampaignBuilderModalProps> = ({
  isOpen,
  onClose,
  shopId,
  campaign,
  onSaved,
}) => {
  const { shop } = useMerchantAuth();
  if (!isOpen) return null;

  const isEditing = Boolean(campaign?.id);

  const [title, setTitle] = useState(campaign?.title || '');
  const [slug, setSlug] = useState(campaign?.slug || '');
  const [isSlugManual, setIsSlugManual] = useState(isEditing && Boolean(campaign?.slug));
  const [isActive, setIsActive] = useState(campaign?.is_active ?? true);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Today and plan expiry date strings for date range constraints
  const todayStr = new Date().toISOString().split('T')[0];
  const planExpiryStr = shop?.subscription_expires_at
    ? new Date(shop.subscription_expires_at).toISOString().split('T')[0]
    : '';

  // Start Date & End Date
  const [startDate, setStartDate] = useState(() => {
    if (campaign?.starts_at) {
      return new Date(campaign.starts_at).toISOString().split('T')[0];
    }
    return todayStr;
  });

  const [endDate, setEndDate] = useState(() => {
    if (campaign?.ends_at) {
      return new Date(campaign.ends_at).toISOString().split('T')[0];
    }
    return planExpiryStr || '';
  });

  // Background and Button Colors
  const [backgroundColor, setBackgroundColor] = useState(campaign?.background_color || '#0F4C5C');
  const [buttonColor, setButtonColor] = useState(campaign?.button_color || '#F26419');

  // Customer Fields Before Scratching
  const defaultFields: CustomerFieldConfig[] = [
    { id: 'name', label: 'Full Name', type: 'text', required: true },
    { id: 'phone', label: 'WhatsApp Phone', type: 'text', required: true },
  ];

  const [customerFields, setCustomerFields] = useState<CustomerFieldConfig[]>(() => {
    if (campaign?.customer_fields && Array.isArray(campaign.customer_fields) && campaign.customer_fields.length > 0) {
      return campaign.customer_fields;
    }
    return defaultFields;
  });

  // Custom Field Form
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomType, setNewCustomType] = useState<'text' | 'date' | 'number'>('text');
  const [newCustomRequired, setNewCustomRequired] = useState(true);
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Social Actions
  const [actions, setActions] = useState<RequiredAction[]>(
    campaign?.required_actions?.length
      ? campaign.required_actions
      : [
          { platform: 'Instagram', label: 'Follow our Instagram', url: 'https://instagram.com' },
          { platform: 'Google Maps', label: 'Review us on Google Maps', url: 'https://maps.google.com' },
        ]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Plan limits telemetry for active campaigns
  const [activeCampaignsCount, setActiveCampaignsCount] = useState(0);
  const [campaignsLimit, setCampaignsLimit] = useState(1);

  useEffect(() => {
    if (!shopId) return;
    async function checkLimits() {
      const { count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('is_active', true);
      setActiveCampaignsCount(count || 0);

      if (shop?.plan_tier) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('campaigns_limit')
          .ilike('slug', shop.plan_tier)
          .single();
        if (planData) {
          setCampaignsLimit(planData.campaigns_limit);
        }
      }
    }
    checkLimits();
  }, [shopId, shop?.plan_tier]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManual) {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(autoSlug);
    }
  };

  // Toggle or add predefined field
  const togglePredefinedField = (id: string, label: string, type: 'text' | 'date' | 'email' | 'select', options?: string[]) => {
    const exists = customerFields.find(f => f.id === id);
    if (exists) {
      if (id === 'name' || id === 'phone') return; // Cannot remove required base fields
      setCustomerFields(customerFields.filter(f => f.id !== id));
    } else {
      setCustomerFields([...customerFields, { id, label, type, required: true, options }]);
    }
  };

  const toggleFieldRequired = (id: string) => {
    if (id === 'name' || id === 'phone') return; // Base fields are always required
    setCustomerFields(customerFields.map(f => (f.id === id ? { ...f, required: !f.required } : f)));
  };

  const addCustomField = () => {
    if (!newCustomLabel.trim()) return;
    const customId = 'custom_' + Date.now();
    setCustomerFields([
      ...customerFields,
      {
        id: customId,
        label: newCustomLabel.trim(),
        type: newCustomType,
        required: newCustomRequired,
      },
    ]);
    setNewCustomLabel('');
    setShowAddCustom(false);
  };

  const removeCustomerField = (id: string) => {
    if (id === 'name' || id === 'phone') return;
    setCustomerFields(customerFields.filter(f => f.id !== id));
  };

  const handleActionChange = (index: number, key: keyof RequiredAction, value: string) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [key]: value };
    setActions(updated);
  };

  const addAction = () => {
    setActions([...actions, { platform: 'Instagram', label: 'Follow on Instagram', url: 'https://instagram.com' }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const executeSave = async (overrideIsActive?: boolean) => {
    const finalIsActive = overrideIsActive !== undefined ? overrideIsActive : isActive;

    if (!title.trim() || !slug.trim()) {
      const err = 'Title and slug are required.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    // 1. Validate Schedule Dates
    if (!startDate || !endDate) {
      const err = 'Both Start Date and End Date are required.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      const err = 'Campaign End Date cannot be earlier than Start Date.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (planExpiryStr) {
      if (startDate > planExpiryStr) {
        const err = `Start Date (${startDate}) cannot exceed your subscribed plan expiry date (${formatDate(shop?.subscription_expires_at)}).`;
        setErrorMsg(err);
        toast.error(err);
        return;
      }
      if (endDate > planExpiryStr) {
        const err = `End Date (${endDate}) cannot exceed your subscribed plan expiry date (${formatDate(shop?.subscription_expires_at)}). Please choose a date within your active subscription or renew your plan.`;
        setErrorMsg(err);
        toast.error(err);
        return;
      }
    }

    // 2. Enforce Plan Active Campaigns Limit
    if (finalIsActive) {
      const isActivating = !isEditing || !campaign?.is_active;
      if (isActivating && campaignsLimit < 999 && activeCampaignsCount >= campaignsLimit) {
        setShowLimitModal(true);
        toast.error(`Active campaign limit reached (${activeCampaignsCount}/${campaignsLimit}).`);
        return;
      }
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const payload = {
        title: title.trim(),
        slug: cleanSlug,
        starts_at: new Date(startDate + 'T00:00:00').toISOString(),
        ends_at: new Date(endDate + 'T23:59:59').toISOString(),
        background_color: backgroundColor,
        button_color: buttonColor,
        customer_fields: customerFields,
        required_fields: customerFields.map(f => f.id),
        required_actions: actions,
        is_active: finalIsActive,
      };

      if (isEditing && campaign) {
        const { error } = await supabase
          .from('campaigns')
          .update(payload)
          .eq('id', campaign.id);

        if (error) throw error;
        toast.success(`Campaign "${title.trim()}" updated successfully!`);
      } else {
        const { data: newCamp, error } = await supabase
          .from('campaigns')
          .insert({
            ...payload,
            shop_id: shopId,
          })
          .select()
          .single();

        if (error) throw error;

        if (newCamp) {
          // Seed starter rewards for the new campaign
          await supabase.from('rewards').insert([
            {
              campaign_id: newCamp.id,
              reward_name: '10% Off Voucher',
              probability_percentage: 50,
              weight: 50,
              win_code_prefix: 'SAVE10',
              allocated_qty: 200,
              supplied_qty: 0,
              max_limit: 200,
              daily_limit: 50,
              hourly_limit: 10,
              is_active: true,
            },
            {
              campaign_id: newCamp.id,
              reward_name: 'Free Mystery Gift',
              probability_percentage: 20,
              weight: 20,
              win_code_prefix: 'GIFT',
              allocated_qty: 50,
              supplied_qty: 0,
              max_limit: 50,
              daily_limit: 15,
              hourly_limit: 5,
              is_active: true,
            },
            {
              campaign_id: newCamp.id,
              reward_name: 'Better Luck Next Time',
              probability_percentage: 30,
              weight: 30,
              win_code_prefix: 'TRY',
              allocated_qty: 500,
              supplied_qty: 0,
              max_limit: 500,
              daily_limit: 100,
              hourly_limit: 20,
              is_active: true,
            },
          ]);

          // Replenish initial prize queue
          await reshufflePrizeQueueRpc(newCamp.id);
        }

        toast.success(`Campaign "${title.trim()}" created successfully!`);
      }

      await onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to save campaign';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-brand/10 text-teal-brand flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Campaign' : 'Create New Campaign'}
              </h3>
              <p className="text-xs text-slate-500">Configure schedule, theme, customer fields & tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Inherited Merchant Store Logo Notice */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            {shop?.logo_url ? (
              <img
                src={shop.logo_url}
                alt="Shop Logo"
                className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center font-bold text-teal-brand text-xs">
                <Store className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Shop Logo</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-normal">
                  Auto-Inherited
                </span>
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Inherited from <strong>{shop?.shop_name || 'Merchant Shop'}</strong> profile.
              </p>
            </div>
          </div>

          {/* Campaign Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Diwali Scratch & Win Festival"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none"
            />
          </div>

          {/* Campaign Slug & Branded Link */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Campaign URL Slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setIsSlugManual(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="diwali-scratch-win"
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none font-mono"
              />
              {isSlugManual && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSlugManual(false);
                    const autoSlug = title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '');
                    setSlug(autoSlug);
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold transition shrink-0"
                  title="Reset slug to auto-match title"
                >
                  Auto Sync
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Live link: <code className="text-teal-brand">https://{shop?.slug || 'shop'}.wonmore.com/{slug || 'slug'}</code>
            </p>
          </div>

          {/* Campaign Validity: Start Date & End Date (Must be inside subscribed plan expiry date) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-brand" />
                Campaign Schedule & Validity
              </label>
              {planExpiryStr && (
                <span className="text-[10px] text-slate-500">
                  Plan expires: <strong className="text-slate-700">{formatDate(shop?.subscription_expires_at)}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Start Date <span className="text-coral-brand">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  max={planExpiryStr || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  End Date <span className="text-coral-brand">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  min={startDate}
                  max={planExpiryStr || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-400">
              ℹ️ Scratch cards are only active between these dates. End date cannot exceed your subscribed plan expiry date.
            </p>
          </div>

          {/* Campaign Theme & Color Pickers (Background & Button Color) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-teal-brand" />
                Campaign Styling & Colors
              </label>
              <span className="text-[10px] text-slate-400">Customizes Customer Screen</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Background Color */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#0F4C5C"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono outline-none uppercase"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {BG_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setBackgroundColor(p.hex)}
                      style={{ backgroundColor: p.hex }}
                      className={`w-5 h-5 rounded-full border transition ${
                        backgroundColor.toLowerCase() === p.hex.toLowerCase()
                          ? 'ring-2 ring-teal-brand ring-offset-1 border-white scale-110'
                          : 'border-slate-300 hover:scale-105'
                      }`}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>

              {/* Button Color */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Button & Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    placeholder="#F26419"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono outline-none uppercase"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {BUTTON_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setButtonColor(p.hex)}
                      style={{ backgroundColor: p.hex }}
                      className={`w-5 h-5 rounded-full border transition ${
                        buttonColor.toLowerCase() === p.hex.toLowerCase()
                          ? 'ring-2 ring-teal-brand ring-offset-1 border-white scale-110'
                          : 'border-slate-300 hover:scale-105'
                      }`}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Live Mini Preview */}
            <div
              className="p-3 rounded-xl border border-slate-200/40 flex items-center justify-between text-xs text-white shadow-inner mt-2 transition-all"
              style={{ backgroundColor }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 drop-shadow" />
                <span className="font-bold drop-shadow-sm">Theme Preview</span>
              </div>
              <button
                type="button"
                style={{ backgroundColor: buttonColor }}
                className="px-3 py-1.5 rounded-lg font-bold text-white shadow-md text-xs transition"
              >
                Scratch & Win
              </button>
            </div>
          </div>

          {/* Required Customer Fields Before Scratching */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-teal-brand" />
                  Customer Information Fields
                </label>
                <p className="text-[11px] text-slate-500">
                  Data collected from customers before scratching the card
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="text-xs font-semibold text-teal-brand hover:text-teal-dark flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            {/* Predefined Quick Toggle Buttons */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Toggle Common Fields:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'dob', label: 'Date of Birth (DOB)', type: 'date' as const },
                  { id: 'place', label: 'City / Place', type: 'text' as const },
                  { id: 'email', label: 'Email Address', type: 'email' as const },
                  { id: 'gender', label: 'Gender', type: 'select' as const, options: ['Male', 'Female', 'Other'] },
                  { id: 'bill_number', label: 'Bill / Invoice No', type: 'text' as const },
                ].map((item) => {
                  const isSelected = customerFields.some(f => f.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePredefinedField(item.id, item.label, item.type, item.options)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                        isSelected
                          ? 'bg-teal-brand text-white border-teal-brand shadow-sm font-semibold'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configured Fields List */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Fields In Form:
              </span>
              {customerFields.map((field) => {
                const isBase = field.id === 'name' || field.id === 'phone';
                return (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{field.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 capitalize">
                        {field.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={isBase}
                          onChange={() => toggleFieldRequired(field.id)}
                          className="rounded text-teal-brand focus:ring-teal-brand"
                        />
                        <span>{field.required ? 'Required' : 'Optional'}</span>
                      </label>

                      {!isBase && (
                        <button
                          type="button"
                          onClick={() => removeCustomerField(field.id)}
                          className="text-slate-400 hover:text-red-500 transition p-1"
                          title="Remove field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Field Adder Form */}
            {showAddCustom && (
              <div className="p-3 bg-white border border-teal-200 rounded-xl space-y-2 mt-2">
                <p className="text-xs font-bold text-teal-900">Add Custom Field</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    placeholder="Field Name (e.g. Car Reg No)"
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand"
                  />
                  <select
                    value={newCustomType}
                    onChange={(e) => setNewCustomType(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none bg-white text-slate-700"
                  >
                    <option value="text">Text</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                  </select>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={newCustomRequired}
                      onChange={(e) => setNewCustomRequired(e.target.checked)}
                      className="rounded text-teal-brand focus:ring-teal-brand"
                    />
                    <span>Required Field</span>
                  </label>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="px-3 py-1 bg-teal-brand hover:bg-teal-dark text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    Add Field
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Social Verification Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Required Social Actions (Follow, Maps, etc.)
              </label>
              <button
                type="button"
                onClick={addAction}
                className="text-xs font-semibold text-teal-brand hover:text-teal-dark flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Task</span>
              </button>
            </div>

            <div className="space-y-2">
              {actions.map((act, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <select
                    value={act.platform}
                    onChange={(e) => handleActionChange(idx, 'platform', e.target.value)}
                    className="text-xs border border-slate-300 rounded p-1.5 bg-white text-slate-700 outline-none w-28 shrink-0"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Google Maps">Google Maps</option>
                    <option value="Facebook">Facebook</option>
                    <option value="YouTube">YouTube</option>
                    <option value="WhatsApp">WhatsApp Channel</option>
                    <option value="Website">Website</option>
                  </select>

                  <input
                    type="text"
                    value={act.label}
                    onChange={(e) => handleActionChange(idx, 'label', e.target.value)}
                    placeholder="Action label"
                    className="flex-1 text-xs border border-slate-300 rounded p-1.5 outline-none"
                  />

                  <input
                    type="text"
                    value={act.url}
                    onChange={(e) => handleActionChange(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 text-xs border border-slate-300 rounded p-1.5 outline-none font-mono"
                  />

                  {actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAction(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Status Checkbox with Plan Limit Note */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActiveCamp"
                checked={isActive}
                onChange={(e) => {
                  if (
                    e.target.checked &&
                    (!isEditing || !campaign?.is_active) &&
                    campaignsLimit < 999 &&
                    activeCampaignsCount >= campaignsLimit
                  ) {
                    setShowLimitModal(true);
                    return;
                  }
                  setIsActive(e.target.checked);
                }}
                className="w-4 h-4 text-teal-brand border-slate-300 rounded focus:ring-teal-brand cursor-pointer"
              />
              <label htmlFor="isActiveCamp" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Campaign is Active & Customer Playable
              </label>
            </div>
            <p className="text-[10px] text-slate-400 pl-6">
              Plan limit: {activeCampaignsCount} / {campaignsLimit >= 999 ? 'Unlimited' : campaignsLimit} active campaigns used under {shop?.plan_tier} plan.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-coral-brand hover:bg-coral-hover text-white rounded-lg text-xs font-bold shadow-md shadow-coral-brand/20 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>

      {/* Limit Reached Popup Modal Dialog */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Campaign Limit Reached</h3>
              <p className="text-xs text-slate-500">
                Your <span className="font-semibold text-slate-800 capitalize">{shop?.plan_tier} Plan</span> allows up to{' '}
                <strong className="text-slate-900">{campaignsLimit} active campaign(s)</strong>. You currently have{' '}
                <strong className="text-coral-brand">{activeCampaignsCount} active campaign(s)</strong> running.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
              <p className="font-bold text-amber-950">Next steps to continue:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                <li>Save this campaign as a <strong>Paused Draft</strong> so your configuration is preserved.</li>
                <li>Pause another live campaign in your directory before activating this one.</li>
                <li>Upgrade your plan for higher concurrent campaigns.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLimitModal(false);
                  setIsActive(false);
                  executeSave(false);
                }}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Save as Paused Draft (Keeps Data)
              </button>

              <a
                href={`https://wa.me/919876543210?text=Hello%20Won%20More%20Admin!%20I%20have%20reached%20the%20active%20campaign%20limit%20for%20${encodeURIComponent(shop?.shop_name || '')}%20and%20want%20to%20upgrade%20my%20plan.`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold text-center block shadow-md shadow-coral-brand/20 transition"
              >
                Upgrade Plan via WhatsApp
              </a>

              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
