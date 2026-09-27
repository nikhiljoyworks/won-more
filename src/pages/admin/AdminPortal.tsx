import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Store, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  MessageCircle, 
  Sparkles, 
  Lock, 
  Key, 
  Calendar,
  Zap,
  ArrowRight,
  Edit,
  Trash2,
  ExternalLink,
  Download,
  Users,
  Eye,
  Filter,
  Layers,
  X,
  CreditCard,
  Tag,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { Shop, Campaign, Lead, PlanStatus, PlanTier, SubscriptionPlan } from '../../types';
import { 
  supabase, 
  getAllAdminLeadsRpc, 
  adminCreateShopRpc, 
  adminUpdateShopRpc, 
  adminDeleteShopRpc 
} from '../../lib/supabase';
import { formatDate, exportLeadsToCsv, formatTimeAgo, resizeImageFile } from '../../lib/utils';
import { buildCampaignUrl, getNavigableCampaignUrl } from '../../lib/domain';
import { toast } from '../../context/ToastContext';
import { uploadImageToR2 } from '../../lib/r2';
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../lib/rateLimit';

export const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState(false);

  // Rate Limiting State (5 attempts -> 90s lockout)
  const [clientIp, setClientIp] = useState<string>('detecting');
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Active Admin Tab: 'shops' | 'campaigns' | 'leads' | 'plans'
  const [activeTab, setActiveTab] = useState<'shops' | 'campaigns' | 'leads' | 'plans'>('shops');

  // Shops State
  const [shops, setShops] = useState<Shop[]>([]);
  const [searchShop, setSearchShop] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PlanStatus>('all');
  const [loadingShops, setLoadingShops] = useState(false);

  // Edit Shop Modal
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  // New Shop Form State
  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [shopLogoUrl, setShopLogoUrl] = useState('');
  const [isDraggingShopLogo, setIsDraggingShopLogo] = useState(false);
  const [planTier, setPlanTier] = useState<string>('growth');
  const [durationDays, setDurationDays] = useState(30);
  const [generatedPin, setGeneratedPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedShopId, setCopiedShopId] = useState<string | null>(null);
  const [newlyCreatedShop, setNewlyCreatedShop] = useState<Shop | null>(null);

  // All Campaigns State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchCampaign, setSearchCampaign] = useState('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // All Leads State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchLead, setSearchLead] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | 'unscratched' | 'pending' | 'claimed'>('all');
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Subscription Plans State (CRUD)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  // Plan Form State
  const [planName, setPlanName] = useState('');
  const [planSlug, setPlanSlug] = useState('');
  const [planPrice, setPlanPrice] = useState(999);
  const [planCurrency, setPlanCurrency] = useState('INR');
  const [planInterval, setPlanInterval] = useState<'month' | 'year' | 'one-time'>('month');
  const [planCampaignsLimit, setPlanCampaignsLimit] = useState(1);
  const [planLeadsLimit, setPlanLeadsLimit] = useState(500);
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [planIsActive, setPlanIsActive] = useState(true);
  const [planDisplayOrder, setPlanDisplayOrder] = useState(1);

  // Restore verified admin session on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('wm_admin_token');
    if (savedToken) {
      setAdminToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  // 1. Fetch Client IP on mount & check initial rate limit state
  useEffect(() => {
    async function initIp() {
      const ip = await getClientIp();
      setClientIp(ip);
      const state = checkRateLimit('admin', ip);
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
          setAuthError(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isBlocked, remainingSeconds]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;

    const trimmed = accessCode.trim();
    if (!trimmed) return;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        resetRateLimit('admin', clientIp);
        const token = data.token || trimmed;
        setAdminToken(token);
        sessionStorage.setItem('wm_admin_token', token);
        setIsAuthenticated(true);
        setAuthError(false);
        toast.success('Admin authentication verified.');
      } else {
        if (data?.isBlocked) {
          setIsBlocked(true);
          setRemainingSeconds(data.remainingSeconds || 90);
          toast.error(data.error || 'Too many attempts. Access blocked for 90 seconds.');
        } else {
          const rateState = recordFailedAttempt('admin', clientIp);
          if (rateState.isBlocked) {
            setIsBlocked(true);
            setRemainingSeconds(rateState.remainingSeconds);
          }
          toast.error(data?.error || 'Invalid admin access code');
        }
        setAuthError(true);
      }
    } catch {
      // Fallback if worker endpoint is not reachable (e.g. standalone preview)
      if (trimmed === 'WM_ADMIN_2026') {
        resetRateLimit('admin', clientIp);
        setAdminToken('WM_ADMIN_2026');
        sessionStorage.setItem('wm_admin_token', 'WM_ADMIN_2026');
        setIsAuthenticated(true);
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('wm_admin_token');
    setAdminToken('');
    setIsAuthenticated(false);
    setAccessCode('');
    toast.success('Logged out from Admin Portal.');
  };

  const generateSecurePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleNameChange = (name: string) => {
    setShopName(name);
    const autoSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setShopSlug(autoSlug);
  };

  // Fetch Shops with aggregate counts
  const fetchShops = async () => {
    setLoadingShops(true);
    try {
      const { data, error } = await supabase
        .from('shops')
        .select(`
          *,
          campaigns (
            id,
            leads (count)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShops(data || []);
    } catch (err) {
      console.error('Error fetching shops', err);
    } finally {
      setLoadingShops(false);
    }
  };

  // Fetch All Campaigns
  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          shops (
            id,
            shop_name,
            slug,
            email,
            whatsapp_number,
            logo_url
          ),
          rewards:rewards!rewards_campaign_id_fkey (*),
          leads (count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error('Error fetching campaigns', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Fetch All Leads
  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const activeSecret = adminToken || sessionStorage.getItem('wm_admin_token') || 'WM_ADMIN_2026';
      const data = await getAllAdminLeadsRpc(activeSecret);
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching leads', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Fetch Subscription Plans
  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching subscription plans', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchShops();
      fetchCampaigns();
      fetchLeads();
      fetchPlans();
      setGeneratedPin(generateSecurePin());
    }
  }, [isAuthenticated]);

  // Handle Logo File Drop / Select for Create Shop (Cloudflare R2)
  const handleShopLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    try {
      const publicUrl = await uploadImageToR2(file, {
        folder: 'logos',
        namePrefix: shopSlug || 'shop-logo',
        maxWidth: 400,
        maxHeight: 400,
      });
      setShopLogoUrl(publicUrl);
      toast.success('Shop logo uploaded to Cloudflare R2!');
    } catch (err) {
      console.error('Failed to upload logo to R2', err);
      toast.error('Failed to upload logo');
    }
  };

  // Handle Logo File Drop / Select for Edit Shop (Cloudflare R2)
  const handleEditShopLogoFile = async (file: File) => {
    if (!editingShop) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    try {
      const publicUrl = await uploadImageToR2(file, {
        folder: 'logos',
        namePrefix: editingShop.slug || 'shop-logo',
        maxWidth: 400,
        maxHeight: 400,
      });
      setEditingShop({ ...editingShop, logo_url: publicUrl });
      toast.success('Shop logo updated in Cloudflare R2!');
    } catch (err) {
      console.error('Failed to upload logo to R2', err);
      toast.error('Failed to upload logo');
    }
  };

  // Create Shop
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const pin = generatedPin || generateSecurePin();
      const cleanSlug = shopSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const activeSecret = adminToken || sessionStorage.getItem('wm_admin_token') || 'WM_ADMIN_2026';
      const createdShop = await adminCreateShopRpc(activeSecret, {
        shop_name: shopName.trim(),
        slug: cleanSlug,
        email: email.trim().toLowerCase(),
        whatsapp_number: whatsapp.trim(),
        logo_url: shopLogoUrl.trim() || '',
        plan_tier: planTier,
        duration_days: durationDays,
        pin: pin,
      });

      // Seed starter campaign for this shop
      const { data: camp } = await supabase
        .from('campaigns')
        .insert({
          shop_id: createdShop.id,
          title: `${shopName.trim()} Scratch & Win`,
          slug: 'rewards',
          logo_url: createdShop.logo_url || null,
          starts_at: new Date().toISOString(),
          ends_at: expiresAt,
          required_actions: [
            { platform: 'Instagram', label: 'Follow our Instagram', url: 'https://instagram.com' }
          ],
          required_fields: ['name', 'phone'],
          is_active: true,
        })
        .select()
        .single();

      if (camp) {
        await supabase.from('rewards').insert([
          {
            campaign_id: camp.id,
            reward_name: '10% Off Entire Purchase',
            probability_percentage: 50,
            weight: 50,
            win_code_prefix: 'SAVE10',
            allocated_qty: 200,
            supplied_qty: 0,
            max_limit: 200,
            is_active: true,
          },
          {
            campaign_id: camp.id,
            reward_name: 'Free Special Gift',
            probability_percentage: 20,
            weight: 20,
            win_code_prefix: 'GIFT',
            allocated_qty: 50,
            supplied_qty: 0,
            max_limit: 50,
            is_active: true,
          },
          {
            campaign_id: camp.id,
            reward_name: 'Better Luck Next Time',
            probability_percentage: 30,
            weight: 30,
            win_code_prefix: 'TRY',
            allocated_qty: 500,
            supplied_qty: 0,
            max_limit: 500,
            is_active: true,
          },
        ]);
        await supabase.rpc('replenish_prize_queue', { p_campaign_id: camp.id });
      }

      setNewlyCreatedShop(createdShop as Shop);
      await fetchShops();
      await fetchCampaigns();

      // Reset form
      setShopName('');
      setShopSlug('');
      setEmail('');
      setWhatsapp('');
      setShopLogoUrl('');
      setGeneratedPin(generateSecurePin());
      toast.success(`Store "${shopName}" registered successfully!`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to register shop');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Shop (CRUD: Edit)
  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    try {
      const cleanSlug = editingShop.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const activeSecret = adminToken || sessionStorage.getItem('wm_admin_token') || 'WM_ADMIN_2026';
      
      await adminUpdateShopRpc(activeSecret, {
        id: editingShop.id,
        shop_name: editingShop.shop_name.trim(),
        slug: cleanSlug,
        email: editingShop.email.trim().toLowerCase(),
        password_pin: editingShop.password_pin.trim(),
        whatsapp_number: editingShop.whatsapp_number.trim(),
        logo_url: editingShop.logo_url?.trim() || '',
        plan_tier: editingShop.plan_tier,
        plan_status: editingShop.plan_status,
        subscription_expires_at: editingShop.subscription_expires_at,
      });

      setEditingShop(null);
      await fetchShops();
      await fetchCampaigns();
      toast.success('Shop details updated successfully!');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to update shop details');
    }
  };

  // Delete Shop (CRUD: Delete)
  const handleDeleteShop = async (shopId: string, shopTitle: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to completely delete "${shopTitle}"?\n\nThis will permanently delete this shop and all associated campaigns, rewards, and leads!`
    );
    if (!confirmed) return;

    try {
      const activeSecret = adminToken || sessionStorage.getItem('wm_admin_token') || 'WM_ADMIN_2026';
      await adminDeleteShopRpc(activeSecret, shopId);
      await fetchShops();
      await fetchCampaigns();
      await fetchLeads();
      toast.success(`Shop "${shopTitle}" deleted successfully.`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete shop');
    }
  };

  // Toggle Campaign Active Status
  const toggleCampaignStatus = async (campId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: nextStatus })
      .eq('id', campId);

    if (!error) {
      setCampaigns(campaigns.map(c => c.id === campId ? { ...c, is_active: nextStatus } : c));
    }
  };

  // Toggle Lead Claimed Status
  const toggleLeadStatus = async (leadId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pending' ? 'claimed' : 'pending';
    const { error } = await supabase
      .from('leads')
      .update({ status: nextStatus })
      .eq('id', leadId);

    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: nextStatus as any } : l));
    }
  };

  // Plan CRUD Handlers
  const openNewPlanModal = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanSlug('');
    setPlanPrice(999);
    setPlanCurrency('INR');
    setPlanInterval('month');
    setPlanCampaignsLimit(1);
    setPlanLeadsLimit(500);
    setPlanFeaturesText('1 Active Campaign\n500 Customer Leads\nStandard Standee\nWhatsApp Claim Link');
    setPlanIsActive(true);
    setPlanDisplayOrder(plans.length + 1);
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (p: SubscriptionPlan) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanSlug(p.slug);
    setPlanPrice(p.price);
    setPlanCurrency(p.currency || 'INR');
    setPlanInterval(p.billing_interval || 'month');
    setPlanCampaignsLimit(p.campaigns_limit);
    setPlanLeadsLimit(p.leads_limit);
    setPlanFeaturesText(Array.isArray(p.features) ? p.features.join('\n') : '');
    setPlanIsActive(p.is_active);
    setPlanDisplayOrder(p.display_order);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || !planSlug.trim()) {
      toast.error('Plan name and slug are required.');
      return;
    }

    const featuresArray = planFeaturesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: planName.trim(),
      slug: planSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      price: Number(planPrice),
      currency: planCurrency.trim().toUpperCase(),
      billing_interval: planInterval,
      campaigns_limit: Number(planCampaignsLimit),
      leads_limit: Number(planLeadsLimit),
      features: featuresArray,
      is_active: planIsActive,
      display_order: Number(planDisplayOrder),
    };

    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', editingPlan.id);
        if (error) throw error;
        toast.success(`Plan "${planName.trim()}" updated successfully!`);
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(payload);
        if (error) throw error;
        toast.success(`Plan "${planName.trim()}" created successfully!`);
      }

      setIsPlanModalOpen(false);
      setEditingPlan(null);
      await fetchPlans();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save subscription plan');
    }
  };

  const handleDeletePlan = async (planId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" plan?`)) return;
    try {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', planId);
      if (error) throw error;
      toast.success(`Plan "${name}" deleted.`);
      await fetchPlans();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete plan');
    }
  };

  const togglePlanActive = async (p: SubscriptionPlan) => {
    const next = !p.is_active;
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: next })
      .eq('id', p.id);
    if (!error) {
      setPlans(plans.map(item => item.id === p.id ? { ...item, is_active: next } : item));
    }
  };

  const copyOnboardingMessage = (shopObj: Shop) => {
    const loginUrl = `${window.location.origin}/merchant-login`;
    const brandedUrl = buildCampaignUrl(shopObj.slug, 'rewards');
    const msg = `Hello ${shopObj.shop_name}! 🎉\n\nYour Won More merchant account is active and ready!\n\n👉 Merchant Login: ${loginUrl}\n📧 Email: ${shopObj.email}\n🔑 Your Secure PIN: ${shopObj.password_pin}\n\n🌟 Your Live Scratch URL: ${brandedUrl}\n\nLog in now to view your live QR code, customize rewards, and start collecting customer leads!`;

    navigator.clipboard.writeText(msg);
    setCopiedShopId(shopObj.id);
    setTimeout(() => setCopiedShopId(null), 3000);
  };

  // Login Barrier
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-coral-brand/20 text-coral-brand flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Super Admin God Mode</h2>
            <p className="text-xs text-slate-400 mt-1">Full CRUD, Store Onboarding, Plans, Campaigns & Leads</p>
          </div>

          {isBlocked ? (
            <div className="p-4 bg-red-500/20 text-red-200 border border-red-500/30 rounded-xl text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-center gap-2 font-bold text-red-300">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Admin Login Blocked (90s)</span>
              </div>
              <p className="text-[11px] text-red-300/80">
                Too many failed attempts from IP <strong className="font-mono text-white">{clientIp}</strong>. Access is temporarily locked for <strong>{remainingSeconds} seconds</strong>.
              </p>
              <div className="pt-1 flex items-center justify-center gap-2 font-mono font-bold text-red-300 text-xs">
                <span>Unlocking in: {remainingSeconds}s</span>
              </div>
            </div>
          ) : authError ? (
            <div className="p-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs animate-fadeIn">
              Incorrect admin access key. (5 consecutive failed attempts will lock admin login for 90 seconds)
            </div>
          ) : null}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                required
                disabled={isBlocked}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter Admin Access Key"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-coral-brand outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>

            {isBlocked ? (
              <button
                type="button"
                disabled
                className="w-full py-3 bg-red-600/80 text-white rounded-xl text-xs font-bold shadow-lg cursor-not-allowed flex items-center justify-center gap-2 transition"
              >
                <Lock className="w-4 h-4" />
                <span>Blocked: Retry in {remainingSeconds}s</span>
              </button>
            ) : (
              <button
                type="submit"
                className="w-full py-3 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold transition shadow-lg shadow-coral-brand/30"
              >
                Authenticate Admin Access
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Filtered Shops
  const filteredShops = shops.filter(s => {
    const matchesSearch =
      s.shop_name.toLowerCase().includes(searchShop.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchShop.toLowerCase()) ||
      s.email.toLowerCase().includes(searchShop.toLowerCase()) ||
      s.whatsapp_number.includes(searchShop);
    const matchesStatus = statusFilter === 'all' || s.plan_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const shopNameMatch = c.shops?.shop_name?.toLowerCase().includes(searchCampaign.toLowerCase());
    const titleMatch = c.title.toLowerCase().includes(searchCampaign.toLowerCase());
    const slugMatch = c.slug.toLowerCase().includes(searchCampaign.toLowerCase());
    return shopNameMatch || titleMatch || slugMatch;
  });

  // Filtered Leads
  const filteredLeads = leads.filter(l => {
    const matchesSearch =
      l.customer_name.toLowerCase().includes(searchLead.toLowerCase()) ||
      l.customer_phone.includes(searchLead) ||
      l.redemption_code.toLowerCase().includes(searchLead.toLowerCase()) ||
      l.reward_won.toLowerCase().includes(searchLead.toLowerCase()) ||
      l.campaigns?.shops?.shop_name?.toLowerCase().includes(searchLead.toLowerCase()) ||
      l.campaigns?.title?.toLowerCase().includes(searchLead.toLowerCase()) ||
      (l.custom_data && JSON.stringify(l.custom_data).toLowerCase().includes(searchLead.toLowerCase()));
    const matchesStatus = leadStatusFilter === 'all' || l.status === leadStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3.5 sm:p-6 md:p-10 space-y-6 sm:space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-coral-brand flex items-center justify-center text-white shadow-lg shadow-coral-brand/30 shrink-0">
            <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex flex-wrap items-center gap-2">
              Won More God Mode <span className="text-[10px] px-2 py-0.5 rounded-full bg-coral-brand/20 text-coral-brand border border-coral-brand/30 font-bold">SUPER ADMIN</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400">Stores (CRUD), Subscription Plans (CRUD), All Campaigns & Customer Leads</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <a
            href="/merchant-login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
          >
            <span>Merchant Login</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Admin Tab Switcher - Horizontal Scroll on Mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 no-scrollbar sm:flex-wrap">
        <button
          onClick={() => setActiveTab('shops')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'shops'
              ? 'bg-coral-brand text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span>Shops Directory ({shops.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'plans'
              ? 'bg-coral-brand text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>Subscription Plans ({plans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'campaigns'
              ? 'bg-coral-brand text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>All Campaigns ({campaigns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'leads'
              ? 'bg-coral-brand text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Customer Leads ({leads.length})</span>
        </button>
      </div>

      {/* TAB 1: SHOPS DIRECTORY & ONBOARDING (CRUD) */}
      {activeTab === 'shops' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Newly Created Notification */}
          {newlyCreatedShop && (
            <div className="bg-emerald-950/60 border-2 border-emerald-500/50 rounded-2xl p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Shop Successfully Registered & Provisioned!</span>
                </div>
                <button
                  onClick={() => setNewlyCreatedShop(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>

              <div className="bg-slate-900/90 rounded-xl p-4 border border-emerald-500/30 text-xs font-mono space-y-1.5 text-slate-300">
                <p><span className="text-slate-500">Shop:</span> {newlyCreatedShop.shop_name} (@{newlyCreatedShop.slug})</p>
                <p><span className="text-slate-500">Email:</span> {newlyCreatedShop.email}</p>
                <p><span className="text-slate-500">Secure PIN:</span> <span className="text-coral-brand font-bold">{newlyCreatedShop.password_pin}</span></p>
              </div>

              <button
                onClick={() => copyOnboardingMessage(newlyCreatedShop)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                {copiedShopId === newlyCreatedShop.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>Copy WhatsApp Onboarding Template</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Create Shop Form (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
                <Plus className="w-5 h-5 text-coral-brand" />
                <h3 className="text-base font-bold text-white">Manual Shop Onboarding</h3>
              </div>

              <form onSubmit={handleCreateShop} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Shop Name</label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Urban Roast Coffee Lab"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-coral-brand font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Shop Username / Slug (For Subdomain & URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">https://</span>
                    <input
                      type="text"
                      required
                      value={shopSlug}
                      onChange={(e) => setShopSlug(e.target.value)}
                      placeholder="urban-roast"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-coral-brand font-mono font-bold outline-none focus:border-coral-brand"
                    />
                    <span className="text-slate-500 font-mono">.wonmore.com</span>
                  </div>
                </div>

                {/* Provision to Add Merchant Logo */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Merchant Logo (Auto-Used in All Campaigns)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shopLogoUrl}
                      onChange={(e) => setShopLogoUrl(e.target.value)}
                      placeholder="https://.../logo.png or drag file below"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-400 font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg cursor-pointer flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleShopLogoFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Dropzone preview */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingShopLogo(true);
                    }}
                    onDragLeave={() => setIsDraggingShopLogo(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingShopLogo(false);
                      if (e.dataTransfer.files?.[0]) handleShopLogoFile(e.dataTransfer.files[0]);
                    }}
                    className={`mt-2 border-2 border-dashed rounded-xl p-3 text-center transition ${
                      isDraggingShopLogo
                        ? 'border-teal-400 bg-teal-400/10'
                        : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    {shopLogoUrl ? (
                      <div className="flex items-center justify-center gap-3">
                        <img
                          src={shopLogoUrl}
                          alt="Preview"
                          className="w-10 h-10 rounded-lg object-contain bg-slate-900 border border-slate-700 p-0.5"
                        />
                        <span className="text-[11px] text-emerald-400 font-semibold">Logo Loaded</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-slate-500 text-[11px]">
                        <ImageIcon className="w-4 h-4 text-teal-400" />
                        <span>Drag & drop shop logo here (PNG, JPG, WebP)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Merchant Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@shop.com"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-coral-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">WhatsApp Number</label>
                    <input
                      type="text"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-coral-brand font-mono"
                    />
                  </div>
                </div>

                {/* Auto-Generated PIN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Auto-Generated PIN</label>
                    <button
                      type="button"
                      onClick={() => setGeneratedPin(generateSecurePin())}
                      className="text-[11px] text-coral-brand hover:underline font-semibold"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={generatedPin}
                    onChange={(e) => setGeneratedPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold tracking-widest text-center text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Plan Tier</label>
                    <select
                      value={planTier}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlanTier(val);
                        if (val === 'life-time') {
                          setDurationDays(36500);
                        } else if (durationDays === 36500) {
                          setDurationDays(30);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none capitalize"
                    >
                      {plans.length > 0 ? (
                        plans.map((p) => (
                          <option key={p.slug} value={p.slug}>
                            {p.name} ({p.currency} {p.price}/{p.billing_interval})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="starter">Starter</option>
                          <option value="growth">Growth</option>
                          <option value="pro">Pro Enterprise</option>
                          <option value="life-time">Life time</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Subscription Days</label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none"
                    >
                      <option value={30}>30 Days (1 Month)</option>
                      <option value={90}>90 Days (Quarterly)</option>
                      <option value={180}>180 Days (Half Year)</option>
                      <option value={365}>365 Days (1 Year)</option>
                      <option value={36500}>Lifetime (100 Years)</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Subscription Expiration:</span>
                  <span className="font-mono text-teal-300 font-semibold">
                    {durationDays >= 36500
                      ? 'Lifetime (No Expiry)'
                      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold transition shadow-lg shadow-coral-brand/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Provision Merchant Shop'}
                </button>
              </form>
            </div>

            {/* Existing Shops Directory (7 Cols) */}
            <div className="lg:col-span-7 bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-teal-400" />
                  <span>Onboarded Shops Directory</span>
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchShop}
                      onChange={(e) => setSearchShop(e.target.value)}
                      placeholder="Search shops..."
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-coral-brand"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white outline-none capitalize"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {loadingShops ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading shops directory...</div>
              ) : filteredShops.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">No shops matching your search.</div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredShops.map((shop) => (
                    <div
                      key={shop.id}
                      className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 hover:border-slate-600 transition"
                    >
                      <div className="space-y-1 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          {shop.logo_url ? (
                            <img
                              src={shop.logo_url}
                              alt=""
                              className="w-7 h-7 rounded-lg object-contain bg-slate-950 border border-slate-700 p-0.5"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-teal-900/40 text-teal-400 flex items-center justify-center font-bold text-xs">
                              {shop.shop_name.charAt(0)}
                            </div>
                          )}
                          <h4 className="text-sm font-bold text-white">{shop.shop_name}</h4>
                          <span className="text-xs text-coral-brand font-mono">@{shop.slug}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {shop.email} • <span className="font-mono text-slate-300">{shop.whatsapp_number}</span>
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                          <span>PIN: <strong className="text-emerald-400 font-mono">{shop.password_pin}</strong></span>
                          <span>Expires: {formatDate(shop.subscription_expires_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-teal-400 border border-slate-700">
                          {shop.plan_tier}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            shop.plan_status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : shop.plan_status === 'paused'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : shop.plan_status === 'pending'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {shop.plan_status}
                        </span>

                        {/* Copy Template */}
                        <button
                          onClick={() => copyOnboardingMessage(shop)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                          title="Copy WhatsApp Message"
                        >
                          {copiedShopId === shop.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingShop(shop)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-teal-400 rounded-lg transition"
                          title="Edit Shop"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteShop(shop.id, shop.shop_name)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition"
                          title="Delete Shop"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION PLANS (CRUD) */}
      {activeTab === 'plans' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-400" />
                <span>Subscription Plans Management</span>
              </h3>
              <p className="text-xs text-slate-400">
                Configure plan pricing, features, campaigns & leads limits
              </p>
            </div>

            <button
              onClick={openNewPlanModal}
              className="flex items-center gap-2 px-4 py-2 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Plan</span>
            </button>
          </div>

          {loadingPlans ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading subscription plans...</div>
          ) : plans.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center space-y-3">
              <CreditCard className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No subscription plans found</p>
              <p className="text-xs text-slate-500">Create your first subscription plan to offer to merchants.</p>
              <button
                onClick={openNewPlanModal}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Starter Plan</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`bg-slate-800 border rounded-2xl p-6 flex flex-col justify-between space-y-6 transition shadow-xl ${
                    p.is_active ? 'border-slate-700 hover:border-slate-600' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-lg text-white">{p.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-coral-brand border border-slate-700">
                          {p.slug}
                        </span>
                      </div>
                      <button
                        onClick={() => togglePlanActive(p)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                          p.is_active
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-slate-900 text-slate-500 border-slate-700'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">
                          {p.currency === 'INR' ? '₹' : '$'}{p.price}
                        </span>
                        <span className="text-xs text-slate-400">/{p.billing_interval}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Up to <strong>{p.campaigns_limit >= 999 ? 'Unlimited' : p.campaigns_limit}</strong> Campaigns • <strong>{p.leads_limit >= 10000 ? 'Unlimited' : p.leads_limit.toLocaleString()}</strong> Leads
                      </p>
                    </div>

                    {/* Features list */}
                    <div className="space-y-2 border-t border-slate-700/60 pt-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Included Features:
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {Array.isArray(p.features) && p.features.map((feat, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700/60">
                    <button
                      onClick={() => openEditPlanModal(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeletePlan(p.id, p.name)}
                      className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-lg transition"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALL CAMPAIGNS INSPECTION */}
      {activeTab === 'campaigns' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 animate-fadeIn shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Global Campaigns Directory</h3>
              <p className="text-xs text-slate-400">Inspect live customer scratch campaigns across all stores</p>
            </div>

            <div className="relative w-full sm:w-auto sm:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchCampaign}
                onChange={(e) => setSearchCampaign(e.target.value)}
                placeholder="Search campaigns or shops..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-coral-brand"
              />
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Store</th>
                    <th className="px-5 py-3">Campaign Title</th>
                    <th className="px-5 py-3">URL Slug</th>
                    <th className="px-5 py-3">Prizes in Pool</th>
                    <th className="px-5 py-3">Total Leads</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3 font-semibold text-white">
                        {c.shops?.shop_name || 'N/A'}
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-200">{c.title}</td>
                      <td className="px-5 py-3 font-mono text-coral-brand">/{c.slug}</td>
                      <td className="px-5 py-3 text-slate-400">{c.rewards?.length || 0} Prizes</td>
                      <td className="px-5 py-3 font-semibold text-white">
                        {Array.isArray(c.leads) ? c.leads.length : 0}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleCampaignStatus(c.id, c.is_active)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                            c.is_active
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {c.is_active ? '● LIVE' : '● PAUSED'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <a
                          href={getNavigableCampaignUrl(c.shops?.slug || 'shop', c.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs font-semibold transition"
                        >
                          <span>Open Web App</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALL LEADS STREAM */}
      {activeTab === 'leads' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 animate-fadeIn shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">All Customer Leads Stream</h3>
              <p className="text-xs text-slate-400">Total {leads.length} customer records captured</p>
            </div>

            <button
              onClick={() => exportLeadsToCsv(leads, 'all-won-more-leads.csv')}
              disabled={leads.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Export All Leads CSV</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchLead}
                onChange={(e) => setSearchLead(e.target.value)}
                placeholder="Search by customer, phone, code, campaign, or store..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-coral-brand"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Status:
              </span>
              {(['all', 'unscratched', 'pending', 'claimed'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setLeadStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition ${
                    leadStatusFilter === st
                      ? 'bg-coral-brand text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'All' : st === 'unscratched' ? '⏳ Unscratched' : st === 'pending' ? '🕒 Pending' : '✅ Claimed'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Store</th>
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">WhatsApp Phone</th>
                    <th className="px-5 py-3">Prize Won</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3 font-semibold text-white">
                        {l.campaigns?.shops?.shop_name || 'Store'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-1 bg-teal-900/60 text-teal-300 border border-teal-700/60 rounded-lg text-xs font-semibold">
                          {l.campaigns?.title || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-200">{l.customer_name}</p>
                        {l.custom_data && Object.keys(l.custom_data).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(l.custom_data).map(([k, v]) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                <span className="font-semibold text-slate-400 capitalize">{k}:</span> {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-400">{l.customer_phone}</td>
                      <td className="px-5 py-3">
                        {l.status === 'unscratched' ? (
                          <span className="text-slate-500 italic text-[11px]">⏳ Card Not Scratched</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">{l.reward_won}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono">
                        {l.status === 'unscratched' ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span className="font-bold text-coral-brand">{l.redemption_code}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {l.status === 'unscratched' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Unscratched
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              l.status === 'claimed'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {l.status === 'claimed' ? 'Claimed' : 'Pending'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(l.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        {l.status === 'unscratched' ? (
                          <span className="text-[11px] text-slate-500 italic py-1 px-2">Awaiting Scratch</span>
                        ) : (
                          <button
                            onClick={() => toggleLeadStatus(l.id, l.status)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-800 rounded-lg transition"
                          >
                            Mark {l.status === 'claimed' ? 'Pending' : 'Claimed'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SHOP MODAL (CRUD: Update) */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8 text-xs text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-teal-400" />
                <span>Edit Shop: {editingShop.shop_name}</span>
              </h3>
              <button
                onClick={() => setEditingShop(null)}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateShop} className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  value={editingShop.shop_name}
                  onChange={(e) => setEditingShop({ ...editingShop, shop_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Shop Slug (Username)</label>
                <input
                  type="text"
                  required
                  value={editingShop.slug}
                  onChange={(e) => setEditingShop({ ...editingShop, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-coral-brand font-mono font-bold outline-none focus:border-teal-400"
                />
              </div>

              {/* Merchant Logo Edit */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Merchant Logo URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingShop.logo_url || ''}
                    onChange={(e) => setEditingShop({ ...editingShop, logo_url: e.target.value })}
                    placeholder="https://.../logo.png"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-teal-400"
                  />
                  <label className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg cursor-pointer flex items-center gap-1 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleEditShopLogoFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
                {editingShop.logo_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={editingShop.logo_url}
                      alt="Logo Preview"
                      className="w-10 h-10 rounded-lg object-contain bg-slate-900 border border-slate-700 p-0.5"
                    />
                    <span className="text-[11px] text-slate-400">Current Logo</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingShop.email}
                    onChange={(e) => setEditingShop({ ...editingShop, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={editingShop.whatsapp_number}
                    onChange={(e) => setEditingShop({ ...editingShop, whatsapp_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Password PIN</label>
                  <input
                    type="text"
                    required
                    value={editingShop.password_pin}
                    onChange={(e) => setEditingShop({ ...editingShop, password_pin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan Tier</label>
                  <select
                    value={editingShop.plan_tier}
                    onChange={(e) => {
                      const nextTier = e.target.value;
                      let nextExp = editingShop.subscription_expires_at;
                      if (nextTier === 'life-time') {
                        nextExp = new Date(Date.now() + 36500 * 24 * 60 * 60 * 1000).toISOString();
                      }
                      setEditingShop({
                        ...editingShop,
                        plan_tier: nextTier,
                        subscription_expires_at: nextExp,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none capitalize"
                  >
                    {plans.length > 0 ? (
                      plans.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name} ({p.currency} {p.price}/{p.billing_interval})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="pro">Pro Enterprise</option>
                        <option value="life-time">Life time</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan Status</label>
                  <select
                    value={editingShop.plan_status}
                    onChange={(e) => setEditingShop({ ...editingShop, plan_status: e.target.value as PlanStatus })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={editingShop.subscription_expires_at ? editingShop.subscription_expires_at.split('T')[0] : ''}
                    onChange={(e) =>
                      setEditingShop({
                        ...editingShop,
                        subscription_expires_at: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none"
                  />
                </div>
              </div>

              {/* Quick Extend Buttons */}
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-700/80 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-medium block">
                  Quick Extend Subscription Duration:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '+30 Days', days: 30 },
                    { label: '+90 Days', days: 90 },
                    { label: '+180 Days', days: 180 },
                    { label: '+1 Year', days: 365 },
                    { label: 'Lifetime', days: 36500 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const base =
                          editingShop.subscription_expires_at &&
                          new Date(editingShop.subscription_expires_at) > new Date()
                            ? new Date(editingShop.subscription_expires_at).getTime()
                            : Date.now();
                        const nextExp = new Date(base + btn.days * 24 * 60 * 60 * 1000).toISOString();
                        setEditingShop({
                          ...editingShop,
                          subscription_expires_at: nextExp,
                          plan_status: 'active',
                        });
                        toast.success(`Subscription extended: ${btn.label}`);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-[10px] font-semibold border border-slate-700 transition"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-md transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SUBSCRIPTION PLAN MODAL (CRUD: Create/Update) */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8 text-xs text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-400" />
                <span>{editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Subscription Plan'}</span>
              </h3>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    value={planName}
                    onChange={(e) => {
                      setPlanName(e.target.value);
                      if (!editingPlan && !planSlug) {
                        setPlanSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    placeholder="e.g. Starter"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan Slug</label>
                  <input
                    type="text"
                    required
                    value={planSlug}
                    onChange={(e) => setPlanSlug(e.target.value)}
                    placeholder="starter"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-coral-brand font-mono font-bold outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Price</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={planPrice}
                    onChange={(e) => setPlanPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Currency</label>
                  <select
                    value={planCurrency}
                    onChange={(e) => setPlanCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Interval</label>
                  <select
                    value={planInterval}
                    onChange={(e) => setPlanInterval(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                    <option value="one-time">One-Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Campaigns Limit</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={planCampaignsLimit}
                    onChange={(e) => setPlanCampaignsLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none"
                  />
                  <span className="text-[10px] text-slate-500">999 = unlimited</span>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Leads Limit</label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={planLeadsLimit}
                    onChange={(e) => setPlanLeadsLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none"
                  />
                  <span className="text-[10px] text-slate-500">10000 = unlimited</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Features (One per line)
                </label>
                <textarea
                  rows={4}
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  placeholder="1 Active Campaign&#10;500 Customer Leads&#10;Standard QR Standee&#10;WhatsApp Claim Link"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={planDisplayOrder}
                    onChange={(e) => setPlanDisplayOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none"
                  />
                </div>
                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={planIsActive}
                      onChange={(e) => setPlanIsActive(e.target.checked)}
                      className="rounded text-teal-500 focus:ring-teal-500"
                    />
                    <span>Plan is Active</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-coral-brand hover:bg-coral-hover text-white font-bold rounded-xl shadow-md transition"
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
