import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Plus, 
  Sparkles, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  Shuffle, 
  Percent, 
  Zap, 
  AlertCircle,
  HelpCircle,
  Layers,
  Archive
} from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { MerchantLayout } from '../../components/merchant/MerchantLayout';
import { PrizePoolController } from '../../components/merchant/PrizePoolController';
import { AddPrizeModal } from '../../components/merchant/AddPrizeModal';
import { PickCatalogPrizeModal } from '../../components/merchant/PickCatalogPrizeModal';
import { EditCampaignPrizeModal } from '../../components/merchant/EditCampaignPrizeModal';
import { CampaignBuilderModal } from '../../components/merchant/CampaignBuilderModal';
import { Campaign, Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { toast } from '../../context/ToastContext';

export const MerchantPrizePool: React.FC = () => {
  const { shop } = useMerchantAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddMasterPrizeOpen, setIsAddMasterPrizeOpen] = useState(false);
  const [isPickCatalogOpen, setIsPickCatalogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Reward | null>(null);
  const [isCampaignBuilderOpen, setIsCampaignBuilderOpen] = useState(false);

  const loadData = async () => {
    if (!shop) return;
    try {
      // 1. Fetch ONLY non-archived campaigns for this shop
      const { data: camps, error: campErr } = await supabase
        .from('campaigns')
        .select(`
          *,
          rewards:rewards!rewards_campaign_id_fkey (*)
        `)
        .eq('shop_id', shop.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (campErr) throw campErr;

      const currentCamps = camps || [];
      setCampaigns(currentCamps);

      const activeCamp =
        currentCamps.find((c) => c.id === selectedCampaignId) || currentCamps[0] || null;

      setCampaign(activeCamp);
      if (activeCamp && selectedCampaignId !== activeCamp.id) {
        setSelectedCampaignId(activeCamp.id);
      } else if (!activeCamp) {
        setSelectedCampaignId('');
        setRewards([]);
      }

      if (activeCamp) {
        // Fetch ordered rewards
        const { data: rews } = await supabase
          .from('rewards')
          .select('*')
          .eq('campaign_id', activeCamp.id)
          .order('display_order', { ascending: true });
        setRewards(rews || []);
      }
    } catch (err) {
      console.error('Failed to load prize pool data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shop?.id, selectedCampaignId]);

  const togglePrizeActive = async (rewardId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('rewards')
        .update({ is_active: !currentActive })
        .eq('id', rewardId);

      if (error) throw error;
      if (campaign) {
        await reshufflePrizeQueueRpc(campaign.id);
      }
      toast.success(currentActive ? 'Prize paused in queue' : 'Prize activated in queue');
      await loadData();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to update prize status');
    }
  };

  const handleDeletePrize = async (rewardId: string, name: string) => {
    if (rewards.length <= 1) {
      toast.warning('You must keep at least one prize in the campaign pool.');
      return;
    }
    const confirmed = window.confirm(`Remove "${name}" from this campaign? (It will remain in your Master Catalog)`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('rewards').delete().eq('id', rewardId);
      if (error) throw error;
      if (campaign) {
        await reshufflePrizeQueueRpc(campaign.id);
      }
      toast.success(`Prize "${name}" removed from campaign.`);
      await loadData();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete prize');
    }
  };

  if (!shop || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg text-slate-500">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading prize pool controller...</span>
        </div>
      </div>
    );
  }

  const activeSlug = campaign?.slug || 'rewards';

  return (
    <MerchantLayout activeCampaignSlug={activeSlug}>
      <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-coral-brand/10 text-coral-brand flex items-center justify-center">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Prize Pool & Queue Controller
                </h2>
                <p className="text-xs text-slate-500">
                  Manage inventory quotas, daily limits, and live scratch card odds
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {campaigns.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Campaign:
                </span>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-teal-brand outline-none shadow-sm focus:ring-2 focus:ring-teal-brand/30"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Pick from Catalog Button */}
            {campaign && (
              <button
                onClick={() => setIsPickCatalogOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-brand hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <Layers className="w-4 h-4" />
                <span>Pick from Catalog</span>
              </button>
            )}

            {/* Create New Master Prize */}
            <button
              onClick={() => setIsAddMasterPrizeOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-coral-brand hover:bg-coral-hover text-white text-xs font-bold rounded-xl shadow-md shadow-coral-brand/20 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Master Prize</span>
            </button>
          </div>
        </div>

        {/* If NO active campaigns exist */}
        {!campaign ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-4 shadow-soft">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">No Active Campaigns Available</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Prizes in the pool belong to a live promotion. You currently have no active campaigns. Create a campaign to configure prizes and launch your scratch card game.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsCampaignBuilderOpen(true)}
                className="px-5 py-2.5 bg-teal-brand text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Campaign</span>
              </button>
              <button
                onClick={() => setIsAddMasterPrizeOpen(true)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Add Prize to Master Catalog</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Prize Pool & Queue Controller Widget */}
            <PrizePoolController
              campaign={campaign}
              rewards={rewards}
              onRefresh={loadData}
            />

            {/* Prize Inventory & Rules Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Prize Inventory & Probability Rules
                  </h3>
                  <p className="text-xs text-slate-500">
                    Active prize pool for <span className="font-semibold text-teal-brand">{campaign.title}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                    {rewards.length} Prizes Configured
                  </span>
                  <button
                    onClick={() => setIsPickCatalogOpen(true)}
                    className="text-xs font-bold text-teal-brand hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add from Catalog
                  </button>
                </div>
              </div>

              {rewards.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <Gift className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-slate-600 font-medium">No prizes configured for this campaign yet.</p>
                  <p className="text-slate-400 text-[11px]">
                    Click "Pick from Catalog" above to select prizes and set their limits.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3">Prize Item</th>
                        <th className="px-5 py-3">Prefix / Code</th>
                        <th className="px-5 py-3">Inventory (Given / Cap)</th>
                        <th className="px-5 py-3">Remaining</th>
                        <th className="px-5 py-3">Odds Weight</th>
                        <th className="px-5 py-3">Limits (Day / Hr)</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {rewards.map((r) => {
                        const remaining = Math.max(0, (r.allocated_qty || 100) - (r.supplied_qty || 0));
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                {r.image_url ? (
                                  <img
                                    src={r.image_url}
                                    alt={r.reward_name}
                                    className="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-brand flex items-center justify-center shrink-0">
                                    <Gift className="w-5 h-5" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-900">{r.reward_name}</p>
                                  {r.description && (
                                    <p className="text-[10px] text-slate-400 truncate max-w-xs">
                                      {r.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-3.5 font-mono text-[11px]">
                              {r.coupon_code ? (
                                <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">
                                  {r.coupon_code}
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {r.win_code_prefix || 'WIN'}
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="space-y-1">
                                <span className="font-bold text-slate-900">
                                  {r.supplied_qty || 0} / {r.allocated_qty || 100}
                                </span>
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-teal-brand rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, Math.round(((r.supplied_qty || 0) / (r.allocated_qty || 100)) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-3.5">
                              <span className={`font-bold font-mono ${remaining <= 5 ? 'text-red-500' : 'text-slate-800'}`}>
                                {remaining}
                              </span>
                            </td>

                            <td className="px-5 py-3.5">
                              <span className="font-extrabold text-teal-brand bg-teal-50 px-2.5 py-1 rounded-md border border-teal-100">
                                {r.weight || 20}
                              </span>
                            </td>

                            <td className="px-5 py-3.5 text-slate-600">
                              <span>{r.daily_limit || '∞'}/day</span> • <span className="text-slate-400">{r.hourly_limit || '∞'}/hr</span>
                            </td>

                            <td className="px-5 py-3.5">
                              <button
                                onClick={() => togglePrizeActive(r.id, r.is_active)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                                  r.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {r.is_active ? '● Active' : '○ Paused'}
                              </button>
                            </td>

                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingPrize(r)}
                                  className="p-1.5 text-slate-500 hover:text-teal-brand hover:bg-teal-50 rounded-lg transition"
                                  title="Adjust quotas and limits"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePrize(r.id, r.reward_name)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                  title="Remove from campaign"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Pick from Catalog Modal */}
      {isPickCatalogOpen && campaign && shop && (
        <PickCatalogPrizeModal
          isOpen={isPickCatalogOpen}
          onClose={() => setIsPickCatalogOpen(false)}
          shopId={shop.id}
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          existingRewardNames={rewards.map((r) => r.reward_name)}
          onPrizeAdded={loadData}
        />
      )}

      {/* Add New Master Prize Modal */}
      {isAddMasterPrizeOpen && shop && (
        <AddPrizeModal
          isOpen={isAddMasterPrizeOpen}
          onClose={() => setIsAddMasterPrizeOpen(false)}
          shopId={shop.id}
          currentCampaignId={campaign?.id}
          onSaved={loadData}
        />
      )}

      {/* Edit Prize Quotas Modal */}
      {editingPrize && campaign && (
        <EditCampaignPrizeModal
          isOpen={Boolean(editingPrize)}
          onClose={() => setEditingPrize(null)}
          prize={editingPrize}
          campaignId={campaign.id}
          onSaved={loadData}
        />
      )}

      {/* Campaign Builder Modal (if no campaigns exist) */}
      {isCampaignBuilderOpen && shop && (
        <CampaignBuilderModal
          isOpen={isCampaignBuilderOpen}
          onClose={() => setIsCampaignBuilderOpen(false)}
          shopId={shop.id}
          onSaved={loadData}
        />
      )}
    </MerchantLayout>
  );
};
