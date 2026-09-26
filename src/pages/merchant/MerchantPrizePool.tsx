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
  HelpCircle
} from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { MerchantLayout } from '../../components/merchant/MerchantLayout';
import { PrizePoolController } from '../../components/merchant/PrizePoolController';
import { AddPrizeModal } from '../../components/merchant/AddPrizeModal';
import { Campaign, Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { toast } from '../../context/ToastContext';

export const MerchantPrizePool: React.FC = () => {
  const { shop } = useMerchantAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [allRewards, setAllRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAddPrizeOpen, setIsAddPrizeOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Reward | null>(null);

  const loadData = async () => {
    if (!shop) return;
    try {
      // 1. Fetch campaigns with rewards
      const { data: camps, error: campErr } = await supabase
        .from('campaigns')
        .select(`
          *,
          rewards:rewards!rewards_campaign_id_fkey (*)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (campErr) throw campErr;

      const currentCamps = camps || [];
      setCampaigns(currentCamps);

      // Collect all rewards across campaigns for template library
      const flat = currentCamps.flatMap(c => c.rewards || []);
      setAllRewards(flat);

      const activeCamp =
        currentCamps.find((c) => c.id === selectedCampaignId) || currentCamps[0] || null;

      setCampaign(activeCamp);
      if (activeCamp && !selectedCampaignId) {
        setSelectedCampaignId(activeCamp.id);
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
      toast.warning('You must have at least one prize in the campaign pool.');
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete the prize "${name}"?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('rewards').delete().eq('id', rewardId);
      if (error) throw error;
      if (campaign) {
        await reshufflePrizeQueueRpc(campaign.id);
      }
      toast.success(`Prize "${name}" deleted from pool.`);
      await loadData();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete prize');
    }
  };

  const handleOpenEdit = (prize: Reward) => {
    setEditingPrize(prize);
    setIsAddPrizeOpen(true);
  };

  const handleOpenNew = () => {
    setEditingPrize(null);
    setIsAddPrizeOpen(true);
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
                  Configure inventory quotas, daily/hourly limits, and control upcoming player rewards
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

            <button
              onClick={handleOpenNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-coral-brand hover:bg-coral-hover text-white text-xs font-bold rounded-xl shadow-md shadow-coral-brand/20 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Prize</span>
            </button>
          </div>
        </div>

        {/* Live Prize Pool & Queue Controller Widget */}
        {campaign ? (
          <PrizePoolController
            campaign={campaign}
            rewards={rewards}
            onRefresh={loadData}
          />
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
            No active campaign selected. Please create a campaign first.
          </div>
        )}

        {/* Prize Inventory & Rules Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Prize Inventory & Probability Rules
              </h3>
              <p className="text-xs text-slate-500">
                Active prize pool for <span className="font-semibold text-teal-brand">{campaign?.title}</span>
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {rewards.length} Prizes Configured
            </span>
          </div>

          {rewards.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Gift className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No prizes configured for this campaign yet. Click "+ Add New Prize" above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Prize Item</th>
                    <th className="px-5 py-3">Prefix</th>
                    <th className="px-5 py-3">Inventory (Allocated / Given)</th>
                    <th className="px-5 py-3">Remaining</th>
                    <th className="px-5 py-3">Weight (Odds)</th>
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
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-coral-light text-coral-brand flex items-center justify-center shrink-0">
                                <Gift className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-900">{r.reward_name}</p>
                              {r.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 max-w-[200px]">
                                  {r.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 font-mono font-bold text-teal-brand text-xs">
                          #{r.win_code_prefix || 'WIN'}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-slate-700">
                          <span className="font-bold text-slate-900">{r.allocated_qty || 100}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-emerald-600 font-semibold">{r.supplied_qty || 0} won</span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              remaining > 10
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : remaining > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {remaining} Left
                          </span>
                        </td>

                        <td className="px-5 py-3.5 font-bold text-amber-600">
                          {r.weight || r.probability_percentage || 10}
                        </td>

                        <td className="px-5 py-3.5 text-[11px] text-slate-500">
                          {r.daily_limit || 50}/day • {r.hourly_limit || 10}/hr
                        </td>

                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => togglePrizeActive(r.id, r.is_active)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                              r.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {r.is_active ? '● Active' : '○ Paused'}
                          </button>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(r)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition"
                              title="Edit Prize"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePrize(r.id, r.reward_name)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
                              title="Delete Prize"
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

      </div>

      {/* Add / Edit Prize Modal matching user screenshot */}
      {isAddPrizeOpen && (
        <AddPrizeModal
          isOpen={isAddPrizeOpen}
          onClose={() => {
            setIsAddPrizeOpen(false);
            setEditingPrize(null);
          }}
          campaigns={campaigns}
          selectedCampaignId={campaign?.id}
          existingPrizes={allRewards}
          prizeToEdit={editingPrize}
          onSaved={loadData}
        />
      )}
    </MerchantLayout>
  );
};
