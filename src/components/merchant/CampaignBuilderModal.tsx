import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  Gift,
  Check,
  MessageCircle,
  ExternalLink,
  Tag
} from 'lucide-react';
import { Campaign, RequiredAction, CustomerFieldConfig } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { formatDate, formatLocalDate, DEFAULT_WHATSAPP_CLAIM_TEMPLATE, interpolateWhatsAppMessage } from '../../lib/utils';
import { toast } from '../../context/ToastContext';

export interface CampaignPrizeItem {
  id?: string;
  reward_name: string;
  win_code_prefix: string;
  coupon_mode?: 'unique_pool' | 'fixed_code';
  coupon_code?: string;
  coupon_codes_text?: string;
  available_codes_count?: number;
  allocated_qty: number;
  weight: number;
  daily_limit?: number;
  hourly_limit?: number;
  image_url?: string | null;
  description?: string | null;
  is_default?: boolean;
}

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

  // Campaign Destination Type: offline (in-store) vs online (website / e-commerce)
  const [campaignType, setCampaignType] = useState<'offline' | 'online'>(
    campaign?.campaign_type || 'offline'
  );
  const [websiteUrl, setWebsiteUrl] = useState(campaign?.website_url || '');
  const [websiteButtonText, setWebsiteButtonText] = useState(
    campaign?.website_button_text || 'Visit Website to Claim Offer'
  );
  const [claimInstructions, setClaimInstructions] = useState(
    campaign?.claim_instructions || ''
  );
  const [headerTagline, setHeaderTagline] = useState(
    campaign?.header_tagline || ''
  );

  const [title, setTitle] = useState(campaign?.title || '');
  const [slug, setSlug] = useState(campaign?.slug || '');
  const [isSlugManual, setIsSlugManual] = useState(isEditing && Boolean(campaign?.slug));
  const [isActive, setIsActive] = useState(campaign?.is_active ?? true);
  const [uniquePhoneOnly, setUniquePhoneOnly] = useState<boolean>(campaign?.unique_phone_only ?? false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Today and plan expiry date strings for date range constraints
  const todayStr = formatLocalDate(new Date());
  const planExpiryStr = shop?.subscription_expires_at
    ? formatLocalDate(shop.subscription_expires_at)
    : '';

  // Start Date & End Date
  const [startDate, setStartDate] = useState(() => {
    if (campaign?.starts_at) {
      return formatLocalDate(campaign.starts_at);
    }
    return todayStr;
  });

  const [endDate, setEndDate] = useState(() => {
    if (campaign?.ends_at) {
      return formatLocalDate(campaign.ends_at);
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

  // Pre-filled WhatsApp Claim Message Template
  const [whatsappMessageTemplate, setWhatsappMessageTemplate] = useState<string>(
    campaign?.whatsapp_message_template || DEFAULT_WHATSAPP_CLAIM_TEMPLATE
  );
  const whatsappTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertVariableAtCursor = (variableTag: string) => {
    const textarea = whatsappTextareaRef.current;
    if (!textarea) {
      setWhatsappMessageTemplate((prev) => (prev ? `${prev} ${variableTag}` : variableTag));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = whatsappMessageTemplate;
    const newText = currentText.substring(0, start) + variableTag + currentText.substring(end);
    setWhatsappMessageTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableTag.length, start + variableTag.length);
    }, 0);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prize Pool Configuration State
  const initialDefaultPrize: CampaignPrizeItem = {
    reward_name: 'Better Luck Next Time',
    win_code_prefix: 'TRY',
    allocated_qty: 1000,
    weight: 30,
    daily_limit: 200,
    hourly_limit: 50,
    is_default: true,
  };

  const [defaultPrize, setDefaultPrize] = useState<CampaignPrizeItem>(initialDefaultPrize);
  const [selectedPrizes, setSelectedPrizes] = useState<CampaignPrizeItem[]>([]);
  const [libraryPrizes, setLibraryPrizes] = useState<CampaignPrizeItem[]>([]);

  // Add custom prize inline form state
  const [showAddCustomPrize, setShowAddCustomPrize] = useState(false);
  const [newPrizeName, setNewPrizeName] = useState('');
  const [newPrizeImageUrl, setNewPrizeImageUrl] = useState('');
  const [newPrizePrefix, setNewPrizePrefix] = useState('WIN');
  const [newPrizeCouponMode, setNewPrizeCouponMode] = useState<'unique_pool' | 'fixed_code'>('unique_pool');
  const [newPrizeCouponCode, setNewPrizeCouponCode] = useState('');
  const [newPrizeCouponCodesText, setNewPrizeCouponCodesText] = useState('');
  const [newPrizeQty, setNewPrizeQty] = useState(100);
  const [newPrizeWeight, setNewPrizeWeight] = useState(20);

  // Plan limits telemetry for active campaigns
  const [activeCampaignsCount, setActiveCampaignsCount] = useState(0);
  const [campaignsLimit, setCampaignsLimit] = useState(1);

  // Dynamically sync fields when modal opens or campaign / shop changes
  useEffect(() => {
    if (isOpen) {
      setTitle(campaign?.title || '');
      setSlug(campaign?.slug || '');
      setIsSlugManual(Boolean(campaign?.id && campaign?.slug));
      setIsActive(campaign?.is_active ?? true);
      setUniquePhoneOnly(campaign?.unique_phone_only ?? false);
      setHeaderTagline(campaign?.header_tagline || '');

      const pExp = shop?.subscription_expires_at
        ? formatLocalDate(shop.subscription_expires_at)
        : '';

      setStartDate(
        campaign?.starts_at
          ? formatLocalDate(campaign.starts_at)
          : todayStr
      );
      // Dynamically default to current subscription end date on new campaign!
      setEndDate(
        campaign?.ends_at
          ? formatLocalDate(campaign.ends_at)
          : (pExp || '')
      );
      setBackgroundColor(campaign?.background_color || '#0F4C5C');
      setButtonColor(campaign?.button_color || '#F26419');
      setWhatsappMessageTemplate(campaign?.whatsapp_message_template || DEFAULT_WHATSAPP_CLAIM_TEMPLATE);

      if (campaign?.customer_fields && Array.isArray(campaign.customer_fields) && campaign.customer_fields.length > 0) {
        setCustomerFields(campaign.customer_fields);
      } else {
        setCustomerFields(defaultFields);
      }

      if (campaign?.required_actions && campaign.required_actions.length > 0) {
        setActions(campaign.required_actions);
      }

      // Load store's library prizes and this campaign's rewards
      async function loadPrizes() {
        if (!shopId) return;

        // 1. Fetch store's past rewards from campaigns belonging to this shop
        const { data: shopCamps } = await supabase
          .from('campaigns')
          .select('id')
          .eq('shop_id', shopId);

        const campIds = (shopCamps || []).map((c: any) => c.id);

        if (campIds.length > 0) {
          const { data: pastRewards } = await supabase
            .from('rewards')
            .select('*')
            .in('campaign_id', campIds)
            .order('created_at', { ascending: false });

          if (pastRewards) {
            const seen = new Set<string>();
            const lib: CampaignPrizeItem[] = [];
            for (const r of pastRewards) {
              const lower = r.reward_name.trim().toLowerCase();
              if (
                lower.includes('better luck') ||
                lower.includes('try again') ||
                r.win_code_prefix === 'TRY'
              ) {
                continue;
              }
              if (!seen.has(lower)) {
                seen.add(lower);
                lib.push({
                  reward_name: r.reward_name,
                  win_code_prefix: r.win_code_prefix || 'WIN',
                  allocated_qty: r.allocated_qty || 100,
                  weight: r.weight || 20,
                  daily_limit: r.daily_limit || 25,
                  hourly_limit: r.hourly_limit || 10,
                  image_url: r.image_url || null,
                  description: r.description || null,
                });
              }
            }
            setLibraryPrizes(lib);
          }
        }

        // 2. If editing existing campaign, load its current rewards
        if (campaign?.id) {
          const { data: currentRewards } = await supabase
            .from('rewards')
            .select('*')
            .eq('campaign_id', campaign.id)
            .order('display_order', { ascending: true });

          // Fetch any existing unused coupon codes for display
          const { data: unusedCodes } = await supabase
            .from('reward_coupon_codes')
            .select('reward_id, code')
            .eq('campaign_id', campaign.id)
            .eq('is_used', false);

          const codesByReward: Record<string, string[]> = {};
          (unusedCodes || []).forEach((c: any) => {
            if (!codesByReward[c.reward_id]) codesByReward[c.reward_id] = [];
            codesByReward[c.reward_id].push(c.code);
          });

          if (currentRewards && currentRewards.length > 0) {
            const defaultIdx = currentRewards.findIndex(
              (r: any) =>
                r.win_code_prefix === 'TRY' ||
                r.reward_name.toLowerCase().includes('better luck') ||
                r.reward_name.toLowerCase().includes('try again')
            );

            if (defaultIdx >= 0) {
              const def = currentRewards[defaultIdx];
              setDefaultPrize({
                id: def.id,
                reward_name: def.reward_name,
                win_code_prefix: def.win_code_prefix || 'TRY',
                coupon_mode: def.coupon_mode || 'unique_pool',
                coupon_code: def.coupon_code || '',
                coupon_codes_text: (codesByReward[def.id] || []).join('\n'),
                available_codes_count: (codesByReward[def.id] || []).length,
                allocated_qty: def.allocated_qty || 1000,
                weight: def.weight || 30,
                daily_limit: def.daily_limit || 200,
                hourly_limit: def.hourly_limit || 50,
                is_default: true,
              });
              const others = currentRewards
                .filter((_: any, idx: number) => idx !== defaultIdx)
                .map((r: any) => ({
                  id: r.id,
                  reward_name: r.reward_name,
                  win_code_prefix: r.win_code_prefix || 'WIN',
                  coupon_mode: r.coupon_mode || 'unique_pool',
                  coupon_code: r.coupon_code || '',
                  coupon_codes_text: (codesByReward[r.id] || []).join('\n'),
                  available_codes_count: (codesByReward[r.id] || []).length,
                  allocated_qty: r.allocated_qty || 100,
                  weight: r.weight || 20,
                  daily_limit: r.daily_limit || 25,
                  hourly_limit: r.hourly_limit || 10,
                  image_url: r.image_url || null,
                  description: r.description || null,
                }));
              setSelectedPrizes(others);
            } else {
              setSelectedPrizes(
                currentRewards.map((r: any) => ({
                  id: r.id,
                  reward_name: r.reward_name,
                  win_code_prefix: r.win_code_prefix || 'WIN',
                  coupon_mode: r.coupon_mode || 'unique_pool',
                  coupon_code: r.coupon_code || '',
                  coupon_codes_text: (codesByReward[r.id] || []).join('\n'),
                  available_codes_count: (codesByReward[r.id] || []).length,
                  allocated_qty: r.allocated_qty || 100,
                  weight: r.weight || 20,
                  daily_limit: r.daily_limit || 25,
                  hourly_limit: r.hourly_limit || 10,
                  image_url: r.image_url || null,
                  description: r.description || null,
                }))
              );
            }
          }
        } else {
          // Brand new campaign: fresh clean default prize and no random prizes!
          setDefaultPrize({
            reward_name: 'Better Luck Next Time',
            win_code_prefix: 'TRY',
            coupon_mode: 'unique_pool',
            coupon_code: '',
            allocated_qty: 1000,
            weight: 30,
            daily_limit: 200,
            hourly_limit: 50,
            is_default: true,
          });
          setSelectedPrizes([]);
        }
      }

      loadPrizes();
    }
  }, [isOpen, campaign, shop, shopId]);

  const totalWeight =
    (Number(defaultPrize.weight) || 0) +
    selectedPrizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

  const toggleLibraryPrize = (libPrize: CampaignPrizeItem) => {
    const exists = selectedPrizes.some(
      (p) => p.reward_name.toLowerCase() === libPrize.reward_name.toLowerCase()
    );
    if (exists) {
      setSelectedPrizes(
        selectedPrizes.filter(
          (p) => p.reward_name.toLowerCase() !== libPrize.reward_name.toLowerCase()
        )
      );
    } else {
      setSelectedPrizes([
        ...selectedPrizes,
        {
          reward_name: libPrize.reward_name,
          win_code_prefix: libPrize.win_code_prefix,
          coupon_mode: campaignType === 'online' ? 'fixed_code' : undefined,
          coupon_code: campaignType === 'online' ? (libPrize.win_code_prefix || 'PROMO') : undefined,
          allocated_qty: libPrize.allocated_qty || 100,
          weight: libPrize.weight || 20,
          daily_limit: libPrize.daily_limit || 25,
          hourly_limit: libPrize.hourly_limit || 10,
          image_url: libPrize.image_url || null,
          description: libPrize.description || null,
        },
      ]);
    }
  };

  const handleAddCustomPrize = () => {
    if (!newPrizeName.trim()) {
      toast.error('Please enter a prize name.');
      return;
    }

    let parsedCodes: string[] = [];
    if (campaignType === 'online') {
      if (newPrizeCouponMode === 'unique_pool') {
        parsedCodes = Array.from(
          new Set(
            newPrizeCouponCodesText
              .split(/[\r\n,]+/)
              .map((c: string) => c.trim().toUpperCase())
              .filter(Boolean)
          )
        );
        if (parsedCodes.length === 0) {
          toast.error('Please paste at least one unique coupon code for this prize.');
          return;
        }
      } else {
        if (!newPrizeCouponCode.trim()) {
          toast.error('Please enter a coupon code (e.g. SAVE20).');
          return;
        }
      }
    }

    const prefix = (newPrizePrefix.trim() || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const finalQty =
      campaignType === 'online' && newPrizeCouponMode === 'unique_pool' && parsedCodes.length > 0
        ? parsedCodes.length
        : Number(newPrizeQty) || 100;

    setSelectedPrizes([
      ...selectedPrizes,
      {
        reward_name: newPrizeName.trim(),
        image_url: newPrizeImageUrl.trim() || null,
        win_code_prefix: prefix,
        coupon_mode: campaignType === 'online' ? newPrizeCouponMode : undefined,
        coupon_code:
          campaignType === 'online' && newPrizeCouponMode === 'fixed_code'
            ? newPrizeCouponCode.trim().toUpperCase()
            : undefined,
        coupon_codes_text:
          campaignType === 'online' && newPrizeCouponMode === 'unique_pool'
            ? newPrizeCouponCodesText
            : undefined,
        available_codes_count: parsedCodes.length > 0 ? parsedCodes.length : undefined,
        allocated_qty: finalQty,
        weight: Number(newPrizeWeight) || 20,
        daily_limit: Math.max(5, Math.round(finalQty / 4)),
        hourly_limit: Math.max(1, Math.round(finalQty / 10)),
      },
    ]);

    setNewPrizeName('');
    setNewPrizeImageUrl('');
    setNewPrizePrefix('WIN');
    setNewPrizeCouponMode('unique_pool');
    setNewPrizeCouponCode('');
    setNewPrizeCouponCodesText('');
    setNewPrizeQty(100);
    setNewPrizeWeight(20);
    setShowAddCustomPrize(false);
    toast.success('Prize added to campaign pool!');
  };

  const removeSelectedPrize = (index: number) => {
    setSelectedPrizes(selectedPrizes.filter((_, i) => i !== index));
  };

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

    // 0. Enforce Subscription Plan Status
    if (!isEditing && shop?.plan_status === 'paused') {
      const err = 'Subscription Paused: Your subscription is currently paused. Creating new campaigns is disabled.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (!isEditing && shop?.plan_status === 'suspended') {
      const err = 'Subscription Suspended: Your account is suspended. Please contact support to resolve.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (!isEditing && shop?.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date()) {
      const err = 'Subscription Expired: Your plan has expired. Please renew your plan before creating new campaigns.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (finalIsActive && (shop?.plan_status === 'paused' || shop?.plan_status === 'suspended')) {
      const err = `Cannot activate campaign while your store subscription is ${shop?.plan_status}.`;
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

    if (campaignType === 'online' && !websiteUrl.trim()) {
      const err = 'Please provide your store / website destination URL for online campaigns.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const payload = {
        title: title.trim(),
        slug: cleanSlug,
        campaign_type: campaignType,
        website_url: campaignType === 'online' ? websiteUrl.trim() : null,
        website_button_text: campaignType === 'online' ? (websiteButtonText.trim() || 'Visit Website to Claim Offer') : null,
        claim_instructions: claimInstructions.trim() || null,
        header_tagline: headerTagline.trim() || null,
        starts_at: (() => {
          const [y, m, d] = startDate.split('-').map(Number);
          return new Date(y, m - 1, d, 0, 0, 0).toISOString();
        })(),
        ends_at: (() => {
          const [y, m, d] = endDate.split('-').map(Number);
          return new Date(y, m - 1, d, 23, 59, 59).toISOString();
        })(),
        background_color: backgroundColor,
        button_color: buttonColor,
        customer_fields: customerFields,
        required_fields: customerFields.map(f => f.id),
        required_actions: actions,
        is_active: finalIsActive,
        unique_phone_only: uniquePhoneOnly,
        whatsapp_message_template: whatsappMessageTemplate.trim() || null,
        logo_url: campaign?.logo_url || shop?.logo_url || null,
      };

      if (!defaultPrize.reward_name.trim()) {
        const err = 'Please provide a display name for the default courtesy prize.';
        setErrorMsg(err);
        toast.error(err);
        setIsSaving(false);
        return;
      }

      const allPrizesToSave = [
        ...selectedPrizes,
        defaultPrize,
      ];

      const cleanTotalWeight = Math.max(1, totalWeight);

      if (isEditing && campaign) {
        // Clear next_prize_override_reward_id first to prevent foreign key errors when rewards are reset
        const { error } = await supabase
          .from('campaigns')
          .update({
            ...payload,
            next_prize_override_reward_id: null,
          })
          .eq('id', campaign.id);

        if (error) throw error;

        // Synchronize configured rewards for this campaign
        await supabase.from('rewards').delete().eq('campaign_id', campaign.id);
        await supabase.from('reward_coupon_codes').delete().eq('campaign_id', campaign.id);

        const rewardsToInsert = allPrizesToSave.map((p, idx) => ({
          campaign_id: campaign.id,
          reward_name: p.reward_name.trim(),
          win_code_prefix: (p.win_code_prefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, ''),
          coupon_mode: campaignType === 'online' ? (p.coupon_mode || 'unique_pool') : null,
          coupon_code: campaignType === 'online' && p.coupon_code ? p.coupon_code.trim().toUpperCase() : null,
          allocated_qty: Number(p.allocated_qty) || 100,
          supplied_qty: 0,
          max_limit: Number(p.allocated_qty) || 100,
          daily_limit: Number(p.daily_limit) || Math.max(10, Math.round((Number(p.allocated_qty) || 100) / 5)),
          hourly_limit: Number(p.hourly_limit) || Math.max(2, Math.round((Number(p.allocated_qty) || 100) / 20)),
          weight: Number(p.weight) || 10,
          probability_percentage: Math.round(((Number(p.weight) || 10) / cleanTotalWeight) * 100),
          image_url: p.image_url || null,
          description: p.description || null,
          display_order: idx,
          is_active: true,
        }));

        const { data: insertedRewards, error: rErr } = await supabase
          .from('rewards')
          .insert(rewardsToInsert)
          .select();

        if (rErr) throw rErr;

        if (campaignType === 'online' && insertedRewards && insertedRewards.length > 0) {
          const couponRows: any[] = [];
          insertedRewards.forEach((r: any, idx: number) => {
            const p = allPrizesToSave[idx];
            if (p && p.coupon_codes_text) {
              const codes = Array.from(
                new Set(p.coupon_codes_text.split(/[\r\n,]+/).map((c: string) => c.trim().toUpperCase()).filter(Boolean))
              );
              codes.forEach((c) => {
                couponRows.push({
                  campaign_id: campaign.id,
                  reward_id: r.id,
                  code: c,
                  is_used: false,
                });
              });
            }
          });
          if (couponRows.length > 0) {
            await supabase.from('reward_coupon_codes').insert(couponRows);
          }
        }

        await reshufflePrizeQueueRpc(campaign.id);

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
          const rewardsToInsert = allPrizesToSave.map((p, idx) => ({
            campaign_id: newCamp.id,
            reward_name: p.reward_name.trim(),
            win_code_prefix: (p.win_code_prefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, ''),
            coupon_mode: campaignType === 'online' ? (p.coupon_mode || 'unique_pool') : null,
            coupon_code: campaignType === 'online' && p.coupon_code ? p.coupon_code.trim().toUpperCase() : null,
            allocated_qty: Number(p.allocated_qty) || 100,
            supplied_qty: 0,
            max_limit: Number(p.allocated_qty) || 100,
            daily_limit: Number(p.daily_limit) || Math.max(10, Math.round((Number(p.allocated_qty) || 100) / 5)),
            hourly_limit: Number(p.hourly_limit) || Math.max(2, Math.round((Number(p.allocated_qty) || 100) / 20)),
            weight: Number(p.weight) || 10,
            probability_percentage: Math.round(((Number(p.weight) || 10) / cleanTotalWeight) * 100),
            image_url: p.image_url || null,
            description: p.description || null,
            display_order: idx,
            is_active: true,
          }));

          const { data: insertedRewards, error: rErr } = await supabase
            .from('rewards')
            .insert(rewardsToInsert)
            .select();

          if (rErr) throw rErr;

          if (campaignType === 'online' && insertedRewards && insertedRewards.length > 0) {
            const couponRows: any[] = [];
            insertedRewards.forEach((r: any, idx: number) => {
              const p = allPrizesToSave[idx];
              if (p && p.coupon_codes_text) {
                const codes = Array.from(
                  new Set(p.coupon_codes_text.split(/[\r\n,]+/).map((c: string) => c.trim().toUpperCase()).filter(Boolean))
                );
                codes.forEach((c) => {
                  couponRows.push({
                    campaign_id: newCamp.id,
                    reward_id: r.id,
                    code: c,
                    is_used: false,
                  });
                });
              }
            });
            if (couponRows.length > 0) {
              await supabase.from('reward_coupon_codes').insert(couponRows);
            }
          }

          // Replenish initial prize queue from the configured rewards
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

  const previewWhatsAppMessage = interpolateWhatsAppMessage(whatsappMessageTemplate, {
    shopName: shop?.shop_name || 'My Store',
    rewardName: selectedPrizes[0]?.reward_name || defaultPrize?.reward_name || '15% Off Total Bill',
    redemptionCode: 'GX6Z-WRK5',
    customerName: 'Rahul Sharma',
    customerPhone: '9876543210',
    campaignTitle: title || 'Festival Scratch & Win',
    customData: customerFields.reduce((acc, f) => {
      if (f.id !== 'name' && f.id !== 'phone') {
        acc[f.id] = f.type === 'date' ? '2000-01-01' : f.type === 'number' ? '101' : 'Sample Value';
      }
      return acc;
    }, {} as Record<string, string>),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 animate-fadeIn max-h-[90vh] overflow-y-auto">
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

          {/* Campaign Destination Mode: Offline (In-Store) vs Online (Website / E-Commerce) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Campaign Type</span>
              <span className="text-[10px] text-slate-400 font-normal">Choose where customers redeem their rewards</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCampaignType('offline')}
                className={`p-3 rounded-xl border text-left transition relative flex flex-col gap-1 ${
                  campaignType === 'offline'
                    ? 'border-teal-brand bg-teal-50/60 ring-2 ring-teal-brand/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Store className={`w-4 h-4 ${campaignType === 'offline' ? 'text-teal-brand' : 'text-slate-500'}`} />
                    <span className={`text-xs font-bold ${campaignType === 'offline' ? 'text-teal-900' : 'text-slate-700'}`}>
                      In-Store (Offline)
                    </span>
                  </div>
                  {campaignType === 'offline' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-brand shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  For physical shops & events. Winners show code in-store or claim on WhatsApp.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCampaignType('online')}
                className={`p-3 rounded-xl border text-left transition relative flex flex-col gap-1 ${
                  campaignType === 'online'
                    ? 'border-teal-brand bg-teal-50/60 ring-2 ring-teal-brand/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className={`w-4 h-4 ${campaignType === 'online' ? 'text-teal-brand' : 'text-slate-500'}`} />
                    <span className={`text-xs font-bold ${campaignType === 'online' ? 'text-teal-900' : 'text-slate-700'}`}>
                      Website (Online)
                    </span>
                  </div>
                  {campaignType === 'online' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-brand shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  For e-commerce & D2C websites. Winners get single-use coupons to shop online.
                </p>
              </button>
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

          {/* Header Subtitle / Tagline (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Top Bar Subtitle / Tagline <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              {headerTagline && (
                <button
                  type="button"
                  onClick={() => setHeaderTagline('')}
                  className="text-[10px] text-teal-brand hover:underline"
                >
                  Reset to default
                </button>
              )}
            </div>
            <input
              type="text"
              value={headerTagline}
              onChange={(e) => setHeaderTagline(e.target.value)}
              placeholder={campaignType === 'online' ? 'Online Scratch & Win' : 'In-Store Scratch & Win'}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Appears directly under your shop name in the top navigation bar. Defaults to {campaignType === 'online' ? '"Online Scratch & Win"' : '"In-Store Scratch & Win"'}.
            </p>
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

          {/* Online Website Destination Settings (Conditional on Online Campaign) */}
          {campaignType === 'online' && (
            <div className="p-4 bg-teal-50/50 border border-teal-200/80 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-brand" />
                <h4 className="text-xs font-bold text-slate-800">Online Store Destination</h4>
                <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded font-semibold">
                  E-Commerce Claim
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Store / Website URL <span className="text-coral-brand">*</span>
                  </label>
                  <input
                    type="url"
                    required={campaignType === 'online'}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourstore.com/shop"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Direct link customers will visit when they click the claim button.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Website Claim Button Text
                  </label>
                  <input
                    type="text"
                    value={websiteButtonText}
                    onChange={(e) => setWebsiteButtonText(e.target.value)}
                    placeholder="Visit Website to Claim Offer"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Appears as the prominent primary button on the win screen.
                  </p>
                </div>
              </div>
            </div>
          )}

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

            <p className="text-[10px] text-slate-500">
              ℹ️ Scratch cards are active between these dates. New campaigns dynamically default to your active subscription expiry ({shop?.subscription_expires_at ? formatDate(shop.subscription_expires_at) : 'Plan Expiry'}).
            </p>
          </div>

          {/* Campaign Prizes & Probability Configuration */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-brand/10 text-teal-brand flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800">
                    Campaign Prizes & Winning Rules
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Configure what players can win. No random dummy prizes are injected.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-teal-50 text-teal-brand border border-teal-200 rounded-full">
                {selectedPrizes.length + 1} {selectedPrizes.length + 1 === 1 ? 'Prize' : 'Prizes'} in Pool
              </span>
            </div>

            {/* 1. Default Courtesy Prize (Configurable per campaign) */}
            <div className="p-3 bg-white border-2 border-amber-200 rounded-xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                    Default Courtesy Prize
                  </span>
                  <span className="text-[10px] text-slate-400">Always Active Fallback</span>
                </div>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ~{Math.round(((Number(defaultPrize.weight) || 1) / Math.max(1, totalWeight)) * 100)}% Chance
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Awarded when player doesn't win an incentive prize or when prizes run out. Fully configurable below:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Display Text / Name <span className="text-coral-brand">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={defaultPrize.reward_name}
                    onChange={(e) =>
                      setDefaultPrize({ ...defaultPrize, reward_name: e.target.value })
                    }
                    placeholder="Better Luck Next Time"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    {campaignType === 'online' ? 'Coupon Code (Optional)' : 'Code Prefix'}
                  </label>
                  <input
                    type="text"
                    value={campaignType === 'online' ? (defaultPrize.coupon_code || '') : defaultPrize.win_code_prefix}
                    onChange={(e) =>
                      setDefaultPrize({
                        ...defaultPrize,
                        win_code_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                        coupon_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                      })
                    }
                    placeholder={campaignType === 'online' ? 'e.g. TRY5' : 'TRY'}
                    maxLength={12}
                    className="w-full px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Weight / Odds
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={defaultPrize.weight}
                    onChange={(e) =>
                      setDefaultPrize({
                        ...defaultPrize,
                        weight: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 2. Previously Added Prizes Library (Quick Select) */}
            {libraryPrizes.length > 0 && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-teal-brand" />
                    Select from Your Store's Prize Library
                  </label>
                  <span className="text-[10px] text-slate-400">Click to toggle on/off</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {libraryPrizes.map((libPrize, i) => {
                    const isSelected = selectedPrizes.some(
                      (p) => p.reward_name.toLowerCase() === libPrize.reward_name.toLowerCase()
                    );
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleLibraryPrize(libPrize)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
                          isSelected
                            ? 'bg-teal-50 border-teal-brand text-teal-brand font-semibold shadow-xs ring-1 ring-teal-brand/30'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-teal-brand shrink-0" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span>{libPrize.reward_name}</span>
                        <span className="text-[10px] opacity-75 font-mono">({libPrize.win_code_prefix})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Add Custom Prize Form / Button */}
            {!showAddCustomPrize ? (
              <button
                type="button"
                onClick={() => setShowAddCustomPrize(true)}
                className="w-full py-2 border-2 border-dashed border-teal-brand/30 hover:border-teal-brand bg-teal-50/30 hover:bg-teal-50/60 text-teal-brand font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Custom Prize to this Campaign</span>
              </button>
            ) : (
              <div className="p-3 bg-white border border-teal-200 rounded-xl space-y-3 shadow-xs animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-teal-brand flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" />
                    New Incentive Prize Details
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomPrize(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Prize Name <span className="text-coral-brand">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPrizeName}
                      onChange={(e) => setNewPrizeName(e.target.value)}
                      placeholder="e.g. Free Beverage, 20% Off, Flat ₹500"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Weight / Odds (1-100)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newPrizeWeight}
                      onChange={(e) => setNewPrizeWeight(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand"
                    />
                  </div>
                </div>

                {/* Prize Image URL & Preferred Size */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-bold text-slate-600">
                      Prize Image URL (Optional)
                    </label>
                    <span className="text-[9px] text-teal-brand font-semibold">
                      Preferred: 600×400px (3:2 or 16:9 banner)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={newPrizeImageUrl}
                    onChange={(e) => setNewPrizeImageUrl(e.target.value)}
                    placeholder="https://.../prize-banner.png"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    High-resolution landscape images ensure promotional discounts and text appear crisp and easy to read.
                  </p>
                </div>

                {/* Online Campaign: Unique Pool vs Fixed Code */}
                {campaignType === 'online' ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-teal-brand" />
                        Website Coupon Code Mode
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewPrizeCouponMode('unique_pool')}
                        className={`p-2 rounded-lg border text-left text-xs transition ${
                          newPrizeCouponMode === 'unique_pool'
                            ? 'bg-teal-50 border-teal-brand text-teal-900 font-bold ring-1 ring-teal-brand/20'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-bold">Bulk Unique Codes</p>
                        <p className="text-[10px] font-normal text-slate-500">1 code per winner (Anti-sharing)</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewPrizeCouponMode('fixed_code')}
                        className={`p-2 rounded-lg border text-left text-xs transition ${
                          newPrizeCouponMode === 'fixed_code'
                            ? 'bg-teal-50 border-teal-brand text-teal-900 font-bold ring-1 ring-teal-brand/20'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-bold">Single Promo Code</p>
                        <p className="text-[10px] font-normal text-slate-500">Same code for all (e.g. SAVE20)</p>
                      </button>
                    </div>

                    {newPrizeCouponMode === 'unique_pool' ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600">
                            Paste Unique Codes (Separated by new lines or commas)
                          </label>
                          {newPrizeCouponCodesText.trim() && (
                            <span className="text-[10px] font-bold text-teal-brand bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                              ✓ {Array.from(new Set(newPrizeCouponCodesText.split(/[\r\n,]+/).map((c: string) => c.trim().toUpperCase()).filter(Boolean))).length} unique codes detected
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={3}
                          value={newPrizeCouponCodesText}
                          onChange={(e) => {
                            setNewPrizeCouponCodesText(e.target.value);
                            const parsed = Array.from(new Set(e.target.value.split(/[\r\n,]+/).map((c: string) => c.trim().toUpperCase()).filter(Boolean)));
                            if (parsed.length > 0) {
                              setNewPrizeQty(parsed.length);
                            }
                          }}
                          placeholder={'WM-A821\nWM-B934\nWM-C102\n...or copy-paste column from Shopify CSV'}
                          className="w-full p-2 text-xs font-mono border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white uppercase"
                        />
                        <p className="text-[10px] text-slate-400">
                          Each winner gets one unique code from this pool. Inventory count matches the pasted codes.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Promo / Coupon Code <span className="text-coral-brand">*</span>
                          </label>
                          <input
                            type="text"
                            value={newPrizeCouponCode}
                            onChange={(e) => setNewPrizeCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                            placeholder="e.g. SAVE20"
                            className="w-full px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Total Quantity
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={newPrizeQty}
                            onChange={(e) => setNewPrizeQty(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Code Prefix
                      </label>
                      <input
                        type="text"
                        value={newPrizePrefix}
                        onChange={(e) =>
                          setNewPrizePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                        }
                        placeholder="WIN"
                        maxLength={6}
                        className="w-full px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Total Qty
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newPrizeQty}
                        onChange={(e) => setNewPrizeQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-brand bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomPrize(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomPrize}
                    className="px-4 py-1.5 bg-teal-brand text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition"
                  >
                    Save Prize to Pool
                  </button>
                </div>
              </div>
            )}

            {/* 4. Active Incentive Prizes in this Campaign */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                Active Incentive Prizes ({selectedPrizes.length})
              </label>

              {selectedPrizes.length === 0 ? (
                <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    No incentive prizes added yet.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Customers will receive the default courtesy prize ({defaultPrize.reward_name}) until you select or add prizes above.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedPrizes.map((p, idx) => {
                    const pct = Math.round(((Number(p.weight) || 1) / Math.max(1, totalWeight)) * 100);
                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-teal-50 text-teal-brand flex items-center justify-center font-bold text-[10px] shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 truncate">
                              {p.reward_name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              {campaignType === 'online' ? (
                                p.coupon_mode === 'fixed_code' ? (
                                  <span className="font-mono uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    Code: {p.coupon_code || 'PROMO'}
                                  </span>
                                ) : (
                                  <span className="font-mono uppercase bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    Pool: {p.available_codes_count ?? p.allocated_qty} Codes
                                  </span>
                                )
                              ) : (
                                <span className="font-mono uppercase bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700">
                                  {p.win_code_prefix}
                                </span>
                              )}
                              <label className="flex items-center gap-1">
                                <span>Qty:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={p.allocated_qty}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value) || 1);
                                    setSelectedPrizes(
                                      selectedPrizes.map((item, i) =>
                                        i === idx ? { ...item, allocated_qty: val } : item
                                      )
                                    );
                                  }}
                                  className="w-14 px-1 py-0.5 border border-slate-200 rounded text-[11px] bg-slate-50 focus:bg-white text-center"
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                <span>Weight:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={p.weight}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value) || 1);
                                    setSelectedPrizes(
                                      selectedPrizes.map((item, i) =>
                                        i === idx ? { ...item, weight: val } : item
                                      )
                                    );
                                  }}
                                  className="w-12 px-1 py-0.5 border border-slate-200 rounded text-[11px] bg-slate-50 focus:bg-white text-center"
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-bold text-teal-brand bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            ~{pct}% Chance
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelectedPrize(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                            title="Remove prize from campaign"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={act.platform}
                      onChange={(e) => handleActionChange(idx, 'platform', e.target.value)}
                      className="text-xs border border-slate-300 rounded p-1.5 bg-white text-slate-700 outline-none flex-1 sm:w-28 shrink-0"
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="Google Maps">Google Maps</option>
                      <option value="Facebook">Facebook</option>
                      <option value="YouTube">YouTube</option>
                      <option value="WhatsApp">WhatsApp Channel</option>
                      <option value="Website">Website</option>
                    </select>

                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="sm:hidden p-1.5 text-slate-400 hover:text-red-500 rounded transition shrink-0"
                        title="Remove task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={act.label}
                    onChange={(e) => handleActionChange(idx, 'label', e.target.value)}
                    placeholder="Action label"
                    className="w-full sm:flex-1 text-xs border border-slate-300 rounded p-1.5 outline-none"
                  />

                  <input
                    type="text"
                    value={act.url}
                    onChange={(e) => handleActionChange(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    className="w-full sm:flex-1 text-xs border border-slate-300 rounded p-1.5 outline-none font-mono"
                  />

                  {actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAction(idx)}
                      className="hidden sm:block p-1.5 text-slate-400 hover:text-red-500 rounded transition shrink-0"
                      title="Remove task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 2 Claim Instructions / Heading Subtitle */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Step 2 Claim Instructions Heading
                </label>
                <p className="text-[11px] text-slate-500">
                  Instruction subtitle displayed to winners right above the scratch result card.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClaimInstructions('')}
                className="text-[11px] font-semibold text-slate-500 hover:text-teal-700 bg-white hover:bg-slate-100 px-2 py-1 border border-slate-200 rounded-lg transition"
              >
                Reset to Default
              </button>
            </div>
            <input
              type="text"
              value={claimInstructions}
              onChange={(e) => setClaimInstructions(e.target.value)}
              placeholder={
                campaignType === 'online'
                  ? 'Copy your unique coupon code and apply at checkout on our website, or claim below.'
                  : 'Show your code in-store or claim instantly on WhatsApp below'
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-brand/30 focus:border-teal-brand outline-none bg-white"
            />
            <p className="text-[10px] text-slate-400">
              Leave blank to automatically use the smart default for {campaignType === 'online' ? 'online campaigns' : 'in-store campaigns'}.
            </p>
          </div>

          {/* Pre-filled WhatsApp Claim Message with Dynamic Variables */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800">
                    Pre-filled WhatsApp Claim Message
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Customize the message sent to your WhatsApp when customers claim their prize.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappMessageTemplate(DEFAULT_WHATSAPP_CLAIM_TEMPLATE)}
                className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 bg-white hover:bg-slate-100 px-2 py-1 border border-slate-200 rounded-lg transition"
              >
                Reset to Default
              </button>
            </div>

            {/* Clickable Variable Tags */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Click variable tag to insert into message:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{{reward_won}}', label: 'Prize Won', icon: '🏆' },
                  { tag: '{{redemption_code}}', label: 'Redemption Code', icon: '🎟️' },
                  { tag: '{{customer_name}}', label: 'Customer Name', icon: '👤' },
                  { tag: '{{customer_phone}}', label: 'Customer Phone', icon: '📱' },
                  { tag: '{{shop_name}}', label: 'Shop Name', icon: '🏪' },
                  { tag: '{{campaign_title}}', label: 'Campaign Title', icon: '🎯' },
                ].map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariableAtCursor(v.tag)}
                    className="px-2 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-[11px] font-mono border border-slate-300 rounded-lg transition flex items-center gap-1 shadow-2xs"
                    title={`Click to insert ${v.tag}`}
                  >
                    <span>{v.icon}</span>
                    <span className="font-semibold">{v.label}</span>
                    <span className="text-[10px] text-slate-400">{v.tag}</span>
                  </button>
                ))}

                {/* Custom Fields Configured in Campaign */}
                {customerFields
                  .filter((f) => f.id !== 'name' && f.id !== 'phone')
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => insertVariableAtCursor(`{{${f.id}}}`)}
                      className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-mono border border-teal-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                      title={`Click to insert {{${f.id}}}`}
                    >
                      <span>📝</span>
                      <span className="font-semibold">{f.label}</span>
                      <span className="text-[10px] text-teal-600">{`{{${f.id}}}`}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Template Textarea */}
            <div>
              <textarea
                ref={whatsappTextareaRef}
                rows={3}
                value={whatsappMessageTemplate}
                onChange={(e) => setWhatsappMessageTemplate(e.target.value)}
                placeholder={DEFAULT_WHATSAPP_CLAIM_TEMPLATE}
                className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white leading-relaxed resize-y"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Tip: Leave blank to use the default system claim message.
              </p>
            </div>

            {/* Live WhatsApp Message Bubble Preview */}
            <div className="p-3 bg-[#EFEAE2] rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Live WhatsApp Message Preview:
              </span>
              <div className="max-w-md bg-white p-3 rounded-lg rounded-tl-none shadow-xs text-xs text-slate-800 border border-slate-200/60 leading-relaxed font-sans relative">
                <p className="whitespace-pre-wrap">{previewWhatsAppMessage}</p>
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                  <span>10:45 AM</span>
                  <span className="text-emerald-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Unique Mobile Participation (Optional) */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="uniquePhoneOnly"
                checked={uniquePhoneOnly}
                onChange={(e) => setUniquePhoneOnly(e.target.checked)}
                className="w-4 h-4 text-teal-brand border-slate-300 rounded focus:ring-teal-brand cursor-pointer mt-0.5"
              />
              <div>
                <label htmlFor="uniquePhoneOnly" className="text-xs font-semibold text-slate-800 cursor-pointer block">
                  Limit to 1 Play Per Mobile Number (Optional)
                </label>
                <p className="text-[11px] text-slate-500">
                  When enabled, customers can participate only once with their phone number in this campaign. Repeated attempts will be prevented.
                </p>
              </div>
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
