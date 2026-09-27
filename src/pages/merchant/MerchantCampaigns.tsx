import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, ExternalLink, Calendar, Users, Eye, Gift, Trash2, Filter, Printer, AlertTriangle } from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { MerchantLayout } from '../../components/merchant/MerchantLayout';
import { Campaign, Reward } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import { buildCampaignUrl, getNavigableCampaignUrl } from '../../lib/domain';
import { CampaignBuilderModal } from '../../components/merchant/CampaignBuilderModal';
import { AddPrizeModal } from '../../components/merchant/AddPrizeModal';
import { PrintStandeeModal } from '../../components/merchant/PrintStandeeModal';
import { toast } from '../../context/ToastContext';

type CampaignFilterStatus = 'active' | 'paused' | 'scheduled' | 'ended' | 'all';

export const MerchantCampaigns: React.FC = () => {
  const { shop } = useMerchantAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLimit, setCampaignsLimit] = useState<number>(1);
  const [allRewards, setAllRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CampaignFilterStatus>('active');

  // Modals state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  
  const [isAddPrizeOpen, setIsAddPrizeOpen] = useState(false);
  const [targetPrizeCampaignId, setTargetPrizeCampaignId] = useState<string>('');

  const [isStandeeOpen, setIsStandeeOpen] = useState(false);
  const [selectedStandeeCampaign, setSelectedStandeeCampaign] = useState<Campaign | null>(null);

  const fetchCampaigns = async () => {
    if (!shop) return;
    try {
      // Fetch plan campaigns limit
      if (shop.plan_tier) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('campaigns_limit')
          .ilike('slug', shop.plan_tier)
          .maybeSingle();
        if (planData?.campaigns_limit != null) {
          setCampaignsLimit(planData.campaigns_limit);
        }
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          rewards:rewards!rewards_campaign_id_fkey (*),
          leads (count)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);

      // Flatten all rewards for prize library
      const flat = (data || []).flatMap(c => c.rewards || []);
      setAllRewards(flat);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaigns directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [shop?.id]);

  const toggleCampaignStatus = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    if (nextStatus) {
      // 1. Subscription active and unexpired check
      if (shop?.subscription_expires_at && new Date(shop.subscription_expires_at) < new Date()) {
        toast.error('Your store subscription has expired. Please renew your subscription to activate campaigns.');
        return;
      }
      if (shop?.plan_status === 'suspended' || shop?.plan_status === 'paused') {
        toast.error(`Your store subscription is currently ${shop.plan_status}. Please contact support or check your subscription.`);
        return;
      }

      // 2. Scheduled end date check
      const targetCamp = campaigns.find(c => c.id === id);
      if (targetCamp?.ends_at && new Date(targetCamp.ends_at) < new Date()) {
        toast.error(`Cannot activate campaign because its scheduled end date (${new Date(targetCamp.ends_at).toLocaleDateString()}) has already passed. Please extend the end date first.`);
        return;
      }

      // 3. Plan active campaigns quota check
      const activeCount = campaigns.filter(c => c.is_active && c.id !== id).length;
      if (activeCount >= campaignsLimit) {
        toast.error(`Plan Quota Exceeded: Your "${shop?.plan_tier}" plan allows a maximum of ${campaignsLimit} active campaign(s). Please pause another campaign or upgrade your subscription plan.`);
        return;
      }
    }

    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: nextStatus })
      .eq('id', id);

    if (!error) {
      setCampaigns(campaigns.map(c => (c.id === id ? { ...c, is_active: nextStatus } : c)));
      toast.success(nextStatus ? 'Campaign activated and is now Live!' : 'Campaign paused.');
    } else {
      toast.error(error.message || 'Failed to update campaign status');
    }
  };

  const handleOpenAddPrize = (campaignId: string) => {
    setTargetPrizeCampaignId(campaignId);
    setIsAddPrizeOpen(true);
  };

  const now = new Date();

  const getCampaignState = (c: Campaign): 'ended' | 'scheduled' | 'active' | 'paused' => {
    if (c.ends_at && new Date(c.ends_at) < now) return 'ended';
    if (c.starts_at && new Date(c.starts_at) > now && c.is_active) return 'scheduled';
    if (c.is_active) return 'active';
    return 'paused';
  };

  const counts = {
    active: campaigns.filter(c => getCampaignState(c) === 'active').length,
    paused: campaigns.filter(c => getCampaignState(c) === 'paused').length,
    scheduled: campaigns.filter(c => getCampaignState(c) === 'scheduled').length,
    ended: campaigns.filter(c => getCampaignState(c) === 'ended').length,
    all: campaigns.length,
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (statusFilter === 'all') return true;
    return getCampaignState(c) === statusFilter;
  });

  return (
    <MerchantLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Paused Subscription Alert */}
        {shop?.plan_status === 'paused' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2.5 shadow-xs animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Subscription Currently Paused</p>
              <p className="text-amber-700 text-[11px] mt-0.5">
                Your store subscription is currently marked as paused by the administrator. Customer access to campaigns is temporarily on hold.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Campaigns Directory</h2>
            <p className="text-xs text-slate-500">
              Manage in-store scratch events, promotional themes, and social verification rules
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs">
              <span className="text-slate-500">Active:</span>
              <span className={campaigns.filter(c => c.is_active).length >= campaignsLimit ? 'text-coral-brand font-bold' : 'text-teal-brand font-bold'}>
                {campaigns.filter(c => c.is_active).length} / {campaignsLimit}
              </span>
              <span className="text-slate-300">|</span>
              <span className="capitalize text-slate-600">{shop?.plan_tier} Plan</span>
            </div>

            <button
              onClick={() => {
                if (campaigns.length > 0) {
                  handleOpenAddPrize(campaigns[0].id);
                } else {
                  toast.info('Please create a campaign first.');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Add Prize to Pool</span>
            </button>

            <button
              onClick={() => {
                setEditingCampaign(null);
                setIsBuilderOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-md shadow-coral-brand/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Campaign</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {campaigns.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-soft">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> State:
              </span>
              {[
                { id: 'active', label: '● Live & Active', count: counts.active },
                { id: 'paused', label: '○ Paused / Draft', count: counts.paused },
                { id: 'scheduled', label: '⏳ Scheduled', count: counts.scheduled },
                { id: 'ended', label: '✕ Ended', count: counts.ended },
                { id: 'all', label: 'All Campaigns', count: counts.all },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as CampaignFilterStatus)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-teal-brand text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              Showing <strong>{filteredCampaigns.length}</strong> of <strong>{campaigns.length}</strong> campaigns
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-soft space-y-3">
            <Sparkles className="w-10 h-10 text-coral-brand mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No Campaigns Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first scratch campaign to start generating QR codes and capturing counter leads.
            </p>
            <button
              onClick={() => {
                setEditingCampaign(null);
                setIsBuilderOpen(true);
              }}
              className="px-5 py-2.5 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              Create Campaign Now
            </button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-soft space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              No campaigns match the &quot;{statusFilter}&quot; filter.
            </p>
            <button
              onClick={() => setStatusFilter('all')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              View All Campaigns ({campaigns.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((c) => {
              const brandedUrl = buildCampaignUrl(shop!.slug, c.slug);
              const navigableUrl = getNavigableCampaignUrl(shop!.slug, c.slug);
              const rewardsList = c.rewards || [];

              const now = new Date();
              const hasEnded = c.ends_at && new Date(c.ends_at) < now;
              const isUpcoming = c.starts_at && new Date(c.starts_at) > now;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 flex flex-col justify-between space-y-4 hover:shadow-card transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url}
                            alt=""
                            className="w-11 h-11 rounded-xl object-cover border border-slate-100 shadow-sm"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-teal-brand/10 text-teal-brand flex items-center justify-center font-bold text-base">
                            {c.title.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 leading-tight">{c.title}</h3>
                          <span className="text-[11px] font-mono text-teal-brand">/{c.slug}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasEnded ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            ✕ Ended
                          </span>
                        ) : isUpcoming && c.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            ⏳ Scheduled
                          </span>
                        ) : null}

                        <button
                          onClick={() => toggleCampaignStatus(c.id, c.is_active)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                            c.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {c.is_active ? '● Live' : '○ Paused'}
                        </button>
                      </div>
                    </div>

                    {/* Quick Prize Preview */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-semibold text-slate-700">Prizes Configured:</span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {rewardsList.length} Items
                        </span>
                      </div>

                      {rewardsList.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-200/60 text-[11px]">
                          {rewardsList.slice(0, 3).map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-slate-600 truncate">
                              <span className="truncate">🎁 {r.reward_name}</span>
                              <span className="font-mono text-slate-400 font-semibold shrink-0 ml-1">
                                {r.weight || r.probability_percentage}%
                              </span>
                            </div>
                          ))}
                          {rewardsList.length > 3 && (
                            <p className="text-[10px] text-teal-brand font-semibold pt-0.5">
                              +{rewardsList.length - 3} more prizes
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" /> Schedule:
                        </span>
                        <span className="font-medium text-slate-700">
                          {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : 'Now'} → {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : 'Ongoing'}
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                        <span>Created:</span>
                        <span>{formatDate(c.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    {/* Secondary Quick Links */}
                    <div className="flex items-center justify-between text-xs">
                      <a
                        href={navigableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 font-semibold text-teal-brand hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Live Preview</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStandeeCampaign(c);
                          setIsStandeeOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200/80 transition"
                        title="Print or Download Standee"
                      >
                        <Printer className="w-3.5 h-3.5 text-teal-600" />
                        <span>QR Standee</span>
                      </button>
                    </div>

                    {/* Primary Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        onClick={() => handleOpenAddPrize(c.id)}
                        className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-700" />
                        <span>Add Prize</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingCampaign(c);
                          setIsBuilderOpen(true);
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition text-center"
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Builder Modal */}
      {isBuilderOpen && (
        <CampaignBuilderModal
          isOpen={isBuilderOpen}
          onClose={() => {
            setIsBuilderOpen(false);
            setEditingCampaign(null);
          }}
          shopId={shop!.id}
          campaign={editingCampaign}
          onSaved={fetchCampaigns}
        />
      )}

      {/* Add Prize Modal matching screenshot */}
      {isAddPrizeOpen && (
        <AddPrizeModal
          isOpen={isAddPrizeOpen}
          onClose={() => setIsAddPrizeOpen(false)}
          campaigns={campaigns}
          selectedCampaignId={targetPrizeCampaignId}
          existingPrizes={allRewards}
          onSaved={fetchCampaigns}
        />
      )}

      {/* Standee Print / Download Modal */}
      {isStandeeOpen && selectedStandeeCampaign && shop && (
        <PrintStandeeModal
          isOpen={isStandeeOpen}
          onClose={() => {
            setIsStandeeOpen(false);
            setSelectedStandeeCampaign(null);
          }}
          shop={shop}
          campaign={selectedStandeeCampaign}
        />
      )}
    </MerchantLayout>
  );
};
