import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Users, 
  Award, 
  Sparkles, 
  Trophy, 
  Printer, 
  Download, 
  Settings, 
  Gift, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  ChevronRight, 
  TrendingUp, 
  Plus,
  AlertTriangle,
  Layers,
  Filter
} from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { MerchantLayout } from '../../components/merchant/MerchantLayout';
import { MetricCard } from '../../components/common/MetricCard';
import { CampaignBuilderModal } from '../../components/merchant/CampaignBuilderModal';
import { RewardConfigModal } from '../../components/merchant/RewardConfigModal';
import { AddPrizeModal } from '../../components/merchant/AddPrizeModal';
import { PrintStandeeModal } from '../../components/merchant/PrintStandeeModal';
import { Campaign, Reward, Lead, SubscriptionPlan } from '../../types';
import { supabase, getMerchantLeadsRpc, updateLeadStatusRpc } from '../../lib/supabase';
import { toast } from '../../context/ToastContext';
import { exportLeadsToCsv, formatTimeAgo, formatDate } from '../../lib/utils';
import { buildCampaignUrl, getNavigableCampaignUrl } from '../../lib/domain';
import { subscribeToShopLeads, broadcastShopLeadEvent, playNotificationChime } from '../../lib/realtime';

export const MerchantDashboard: React.FC = () => {
  const { shop, sessionToken } = useMerchantAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // Default to 'all' campaigns overview first, with campaign-wise filter next to it
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allRewards, setAllRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan limits
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);

  // Modals state
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaignData, setEditingCampaignData] = useState<Campaign | null>(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [isAddPrizeModalOpen, setIsAddPrizeModalOpen] = useState(false);
  const [isStandeeModalOpen, setIsStandeeModalOpen] = useState(false);

  const loadData = async () => {
    if (!shop) return;
    try {
      // 1. Fetch all active campaigns for this shop
      const { data: camps, error: campErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (campErr) throw campErr;

      let currentCamps = camps || [];

      // If no campaign exists yet, only auto-create if merchant has NEVER created one (first signup)
      if (currentCamps.length === 0) {
        const { count: totalEver } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id);

        if ((totalEver || 0) === 0) {
          const { data: newCamp } = await supabase
            .from('campaigns')
            .insert({
              shop_id: shop.id,
              title: `${shop.shop_name} Rewards`,
              slug: 'rewards',
              required_actions: [
                { platform: 'Instagram', label: 'Follow our Instagram', url: 'https://instagram.com' }
              ],
              required_fields: ['name', 'phone'],
              is_active: true,
            })
            .select()
            .single();
          if (newCamp) {
            currentCamps = [newCamp as Campaign];
            await supabase.from('rewards').insert([
              {
                campaign_id: newCamp.id,
                reward_name: 'Better Luck Next Time',
                probability_percentage: 100,
                weight: 100,
                win_code_prefix: 'TRY',
                allocated_qty: 10000,
                supplied_qty: 0,
                max_limit: 10000,
                daily_limit: 10000,
                hourly_limit: 10000,
                is_default: true,
                is_active: true,
              },
            ]);
            await supabase.rpc('replenish_prize_queue', { p_campaign_id: newCamp.id });
          }
        }
      }

      setCampaigns(currentCamps);

      // 2. Fetch all leads across all campaigns for this shop using secure session
      if (sessionToken) {
        const leadData = await getMerchantLeadsRpc(sessionToken);
        setAllLeads(leadData);
      } else {
        setAllLeads([]);
      }

      // 3. Fetch all rewards for this shop's campaigns
      const { data: rews } = await supabase
        .from('rewards')
        .select(`
          *,
          campaign:campaigns!inner (
            id,
            shop_id
          )
        `)
        .eq('campaign.shop_id', shop.id)
        .order('display_order', { ascending: true });

      setAllRewards(rews || []);

      // 4. Fetch subscription plan limits
      if (shop.plan_tier) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('*')
          .ilike('slug', shop.plan_tier)
          .single();
        if (planData) {
          setCurrentPlan(planData);
        }
      }
    } catch (err) {
      console.error('Failed to load merchant dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shop?.id]);

  // Real-time WebSocket lead updates (0 polling, sub-second latency)
  useEffect(() => {
    if (!shop?.id) return;

    const unsubscribe = subscribeToShopLeads(shop.id, {
      onNewLead: (newLead) => {
        if (newLead) {
          setAllLeads((prev) => {
            if (prev.some((l) => l.id === newLead.id)) return prev;
            return [newLead, ...prev];
          });
          playNotificationChime();
          toast.success(`🎉 New Lead: ${newLead.customer_name} won ${newLead.reward_won}!`);
        } else {
          // Zero-PII safe ping: reload dashboard data securely
          loadData();
          playNotificationChime();
          toast.success('🎉 New campaign participant joined!');
        }
      },
      onStatusUpdated: (leadId, status) => {
        setAllLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: status as any } : l))
        );
      },
    });

    return () => {
      unsubscribe();
    };
  }, [shop?.id]);

  // Derived filtered data based on selectedCampaignId ('all' vs specific ID)
  const isAllView = selectedCampaignId === 'all';

  const displayedCampaign = isAllView
    ? campaigns[0] || null
    : campaigns.find(c => c.id === selectedCampaignId) || campaigns[0] || null;

  const displayedLeads = isAllView
    ? allLeads
    : allLeads.filter(l => l.campaign_id === selectedCampaignId);

  const displayedRewards = isAllView
    ? allRewards
    : allRewards.filter(r => r.campaign_id === selectedCampaignId);

  const toggleCampaignStatus = async () => {
    if (!displayedCampaign) return;
    const nextStatus = !displayedCampaign.is_active;

    // Check plan limits before activating
    if (nextStatus) {
      const activeCount = campaigns.filter(c => c.is_active).length;
      const limit = currentPlan?.campaigns_limit ?? 1;
      if (limit < 999 && activeCount >= limit) {
        toast.error(
          `Plan Limit Reached: Your ${shop?.plan_tier} plan allows a maximum of ${limit} active campaign(s). Please pause another campaign or upgrade your subscription plan.`
        );
        return;
      }
    }

    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: nextStatus })
      .eq('id', displayedCampaign.id);

    if (!error) {
      setCampaigns(campaigns.map(c => c.id === displayedCampaign.id ? { ...c, is_active: nextStatus } : c));
      toast.success(nextStatus ? 'Campaign is now Live!' : 'Campaign paused.');
    } else {
      toast.error(error.message || 'Failed to update campaign status');
    }
  };

  const toggleLeadStatus = async (leadId: string, currentStatus: string) => {
    if (currentStatus === 'unscratched') {
      toast.error('Cannot claim an unscratched card. Customer must scratch the card first.');
      return;
    }
    const nextStatus = currentStatus === 'pending' ? 'claimed' : 'pending';
    if (!sessionToken) return;

    try {
      const success = await updateLeadStatusRpc(sessionToken, leadId, nextStatus);
      if (success) {
        setAllLeads(allLeads.map(l => (l.id === leadId ? { ...l, status: nextStatus as any } : l)));
        if (shop?.id) {
          broadcastShopLeadEvent(shop.id, 'LEAD_STATUS_UPDATED', {
            leadId,
            status: nextStatus,
          });
        }
        toast.success(`Marked as ${nextStatus === 'claimed' ? 'Claimed' : 'Pending'}`);
      } else {
        toast.error('Failed to update lead status. Please try again.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead status');
    }
  };

  // Compute real 7-day sparklines from actual displayed leads
  const compute7DaySparkline = (leadsList: Lead[]) => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    leadsList.forEach(lead => {
      const leadDate = new Date(lead.created_at);
      const diffDays = Math.floor((now.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        counts[6 - diffDays]++;
      }
    });
    return counts;
  };

  const leadSparkline = compute7DaySparkline(displayedLeads);
  const claimedSparkline = compute7DaySparkline(displayedLeads.filter(l => l.status === 'claimed'));

  if (!shop || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg text-slate-500">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading store dashboard telemetry...</span>
        </div>
      </div>
    );
  }

  const activeSlug = displayedCampaign?.slug || 'rewards';
  const brandedUrl = buildCampaignUrl(shop.slug, activeSlug);
  const navigableUrl = getNavigableCampaignUrl(shop.slug, activeSlug);

  // Real Metrics
  const totalLeads = displayedLeads.length;
  const unscratchedCount = displayedLeads.filter(l => l.status === 'unscratched').length;
  const claimedCount = displayedLeads.filter(l => l.status === 'claimed').length;
  const pendingCount = displayedLeads.filter(l => l.status === 'pending').length;
  const scratchedCount = claimedCount + pendingCount;
  const claimRate = scratchedCount > 0 ? Math.round((claimedCount / scratchedCount) * 100) : 0;
  const leadsThisWeek = leadSparkline.reduce((a, b) => a + b, 0);

  // Plan Limits and Telemetry
  const activeCampaignsCount = campaigns.filter(c => c.is_active).length;
  const campaignsLimit = currentPlan?.campaigns_limit ?? 1;
  const totalShopLeadsCount = allLeads.length;
  const leadsLimit = currentPlan?.leads_limit ?? 500;
  const isLeadsQuotaReached = leadsLimit < 10000 && totalShopLeadsCount >= leadsLimit;
  const isCampaignQuotaReached = campaignsLimit < 999 && activeCampaignsCount >= campaignsLimit;

  return (
    <MerchantLayout activeCampaignSlug={activeSlug}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Paused Subscription Alert */}
        {shop?.plan_status === 'paused' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2.5 shadow-xs animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Subscription Currently Paused</p>
              <p className="text-amber-700 text-[11px] mt-0.5">
                Your store subscription is currently marked as paused by the administrator. Customer access to campaigns is temporarily on hold, and creating new campaigns is disabled.
              </p>
            </div>
          </div>
        )}

        {/* Plan Quota Telemetry Banner */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-soft flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Subscription Plan Limits:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 capitalize">
              {shop.plan_tier} Tier
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Sync Active</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* Active Campaigns Quota */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Active Campaigns:</span>
              <span className={`font-bold ${isCampaignQuotaReached ? 'text-amber-600' : 'text-slate-900'}`}>
                {activeCampaignsCount} / {campaignsLimit >= 999 ? 'Unlimited' : campaignsLimit}
              </span>
            </div>

            <span className="text-slate-300">|</span>

            {/* Total Leads Quota */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Customer Leads Used:</span>
              <span className={`font-bold ${isLeadsQuotaReached ? 'text-red-600' : 'text-slate-900'}`}>
                {totalShopLeadsCount} / {leadsLimit >= 10000 ? 'Unlimited' : leadsLimit.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400">
                ({leadsLimit >= 10000 ? '0' : Math.min(100, Math.round((totalShopLeadsCount / leadsLimit) * 100))}%)
              </span>
            </div>

            {isLeadsQuotaReached && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Quota Reached
              </span>
            )}
          </div>
        </div>

        {/* Campaign Filter Switcher Bar (1st shows all campaigns details, with campaign-wise filter next to it) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-teal-brand" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                Campaign Filter:
              </span>
            </div>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-brand/30 shadow-xs truncate cursor-pointer"
            >
              <option value="all">🌟 All Campaigns ({campaigns.length} Total - Overview)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  🎯 {c.title} ({c.is_active ? '● Live' : '○ Paused'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                if (shop?.plan_status === 'paused') {
                  toast.error('Subscription Paused: Your subscription is currently paused by the administrator. Creating new campaigns is disabled.');
                  return;
                }
                if (shop?.plan_status === 'suspended') {
                  toast.error('Subscription Suspended: Your account is suspended. Please contact support via WhatsApp.');
                  return;
                }
                if (shop?.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date()) {
                  toast.error('Subscription Expired: Your store plan has expired. Please renew your subscription to create campaigns.');
                  return;
                }
                setEditingCampaignData(null); // Create new
                setIsCampaignModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition text-center"
              title="Create New Campaign"
            >
              <Plus className="w-3.5 h-3.5 text-teal-brand shrink-0" />
              <span className="hidden sm:inline">New Campaign</span>
              <span className="sm:hidden">Campaign</span>
            </button>

            <button
              onClick={() => setIsAddPrizeModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition text-center"
              title="Add Prize to Pool"
            >
              <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Add Prize</span>
              <span className="sm:hidden">Prize</span>
            </button>

            <button
              onClick={() => setIsStandeeModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-coral-brand hover:bg-coral-hover text-white text-xs font-bold rounded-xl shadow-xs shadow-coral-brand/20 transition text-center"
              title="Print QR Counter Standee"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">QR Standee</span>
              <span className="sm:hidden">Standee</span>
            </button>
          </div>
        </div>

        {/* Top Stats Row (Pure Real Data from Supabase) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title={isAllView ? 'Total Leads (All Campaigns)' : 'Campaign Leads'}
            value={totalLeads}
            trendText={`${leadsThisWeek} this week`}
            icon={Users}
            sparklineData={leadSparkline}
            chartColor="#0F4C5C"
            subtitle="Verified customer contacts captured"
          />
          <MetricCard
            title="Prizes Claimed"
            value={claimedCount}
            trendText={`${claimRate}% claim rate`}
            icon={Award}
            sparklineData={claimedSparkline}
            chartColor="#F26419"
            subtitle="Redeemed in-store via WhatsApp"
          />
          <MetricCard
            title="Pending Claims"
            value={pendingCount}
            trendText={unscratchedCount > 0 ? `${unscratchedCount} unscratched` : "Awaiting cashier"}
            icon={Sparkles}
            sparklineData={[0, 0, 0, 0, 0, 0, pendingCount]}
            chartColor="#10B981"
            subtitle="Scratched prizes awaiting cashier"
          />
          <MetricCard
            title={isAllView ? 'Total Prize Items' : 'Campaign Prize Items'}
            value={displayedRewards.length}
            trendText={isAllView ? `${activeCampaignsCount} Active Campaigns` : 'In rotation'}
            icon={Trophy}
            sparklineData={[0, 0, 0, 0, 0, 0, displayedRewards.length]}
            chartColor="#6366F1"
            subtitle={isAllView ? 'Prizes across all store campaigns' : 'Prizes configured in this campaign'}
          />
        </div>

        {/* Middle Section: 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: QR Code & Live Link Standee Preview (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl p-6 border border-slate-200 shadow-soft space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {isAllView ? 'Store Overview' : 'Campaign Status'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5 truncate">
                  {isAllView ? 'All Campaigns View' : displayedCampaign?.title}
                </h3>
              </div>

              {!isAllView && displayedCampaign && (
                <button
                  onClick={toggleCampaignStatus}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                    displayedCampaign.is_active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${displayedCampaign.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {displayedCampaign.is_active ? 'Live' : 'Paused'}
                </button>
              )}
            </div>

            {/* Campaign Schedule Dates info if individual campaign selected */}
            {!isAllView && displayedCampaign?.starts_at && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Starts:</span>
                  <strong className="text-slate-800">{formatDate(displayedCampaign.starts_at)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ends:</span>
                  <strong className="text-slate-800">{formatDate(displayedCampaign.ends_at)}</strong>
                </div>
              </div>
            )}

            {/* Scannable QR Code */}
            <div className="text-center p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <div className="inline-block p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                <QRCodeSVG
                  value={navigableUrl}
                  size={140}
                  level="M"
                  includeMargin={true}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500">Live Customer Branded URL</p>
                <a
                  href={navigableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-teal-brand hover:underline inline-flex items-center gap-1 mt-0.5 break-all"
                >
                  <span>{brandedUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>

            {/* Real Stats: Leads Captured & Prizes Claimed */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100/60">
                <span className="text-[11px] font-semibold text-slate-500">Leads in View</span>
                <p className="text-lg font-bold text-teal-brand mt-0.5">{totalLeads}</p>
              </div>
              <div className="p-3 bg-coral-light/50 rounded-xl border border-coral-brand/20">
                <span className="text-[11px] font-semibold text-slate-500">Claimed</span>
                <p className="text-lg font-bold text-coral-brand mt-0.5">{claimedCount}</p>
              </div>
            </div>

            {/* Coral Action Button */}
            <button
              onClick={() => setIsStandeeModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-md shadow-coral-brand/25 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print QR Standee</span>
            </button>
          </div>

          {/* Center Column: Recent Winners List & CSV Export (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-slate-200 shadow-soft flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Recent Winners</h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Realtime Stream
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {isAllView ? 'Customer leads stream across all campaigns' : `Leads for ${displayedCampaign?.title}`}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                  {displayedLeads.length} Total
                </span>
              </div>

              {displayedLeads.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No customer leads yet for this selection. Share your QR standee to start collecting leads!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                  {displayedLeads.slice(0, 7).map((lead) => (
                    <div key={lead.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">{lead.customer_name}</p>
                          {isAllView && lead.campaign?.title && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold truncate max-w-[120px]">
                              {lead.campaign.title}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">{lead.customer_phone}</p>
                        {lead.status === 'unscratched' ? (
                          <p className="text-xs text-slate-400 italic mt-0.5 truncate">
                            ⏳ Card Not Scratched Yet
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-teal-brand mt-0.5 truncate">
                            🏆 {lead.reward_won}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {lead.status === 'unscratched' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Unscratched
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleLeadStatus(lead.id, lead.status)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1 ${
                              lead.status === 'claimed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Click to toggle claimed status"
                          >
                            {lead.status === 'claimed' ? (
                              <>
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Claimed
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending
                              </>
                            )}
                          </button>
                        )}
                        <span className="text-[10px] text-slate-400">{formatTimeAgo(lead.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Export CSV Button at Bottom */}
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={() => exportLeadsToCsv(displayedLeads, `${shop.slug}-${activeSlug}-winners.csv`)}
                disabled={displayedLeads.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV ({displayedLeads.length} Leads)</span>
              </button>
            </div>
          </div>

          {/* Right Column: Quick Actions & Real Activity Feed (3 Cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Quick Actions Stack */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h3>
              
              <button
                onClick={() => setIsAddPrizeModalOpen(true)}
                className="w-full flex items-center justify-between p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <span className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  Add New Prize
                </span>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {displayedCampaign && (
                <button
                  onClick={() => {
                    setEditingCampaignData(displayedCampaign);
                    setIsCampaignModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Campaign Settings
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-75" />
                </button>
              )}
            </div>

            {/* Real Activity Timeline Feed (Populated from real leads, zero mock text) */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest Activity</h3>
              {displayedLeads.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {displayedLeads.slice(0, 4).map((l) => (
                    <div key={l.id} className="flex gap-2.5 text-xs">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          l.status === 'claimed' ? 'bg-emerald-500' : 'bg-coral-brand'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                          {l.customer_name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Won: <span className="font-medium text-teal-brand">{l.reward_won}</span>
                        </p>
                        <span className="text-[10px] text-slate-400">{formatTimeAgo(l.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Campaign Builder Modal */}
      <CampaignBuilderModal
        isOpen={isCampaignModalOpen}
        onClose={() => {
          setIsCampaignModalOpen(false);
          setEditingCampaignData(null);
        }}
        shopId={shop.id}
        campaign={editingCampaignData}
        onSaved={loadData}
      />

      {/* Add Prize Modal */}
      <AddPrizeModal
        isOpen={isAddPrizeModalOpen}
        onClose={() => setIsAddPrizeModalOpen(false)}
        shopId={shop.id}
        currentCampaignId={displayedCampaign?.id}
        onSaved={loadData}
      />

      {/* Standee Print Modal */}
      {displayedCampaign && (
        <PrintStandeeModal
          isOpen={isStandeeModalOpen}
          onClose={() => setIsStandeeModalOpen(false)}
          shop={shop}
          campaign={displayedCampaign}
        />
      )}
    </MerchantLayout>
  );
};
