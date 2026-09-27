import React, { useState } from 'react';
import { Gift, Zap, Shuffle, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Campaign, Reward, PrizeQueueItem } from '../../types';
import { setNextPrizeSecureRpc, clearNextPrizeSecureRpc, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { toast } from '../../context/ToastContext';

interface PrizePoolControllerProps {
  campaign: Campaign;
  rewards: Reward[];
  onRefresh: () => Promise<void>;
}

export const PrizePoolController: React.FC<PrizePoolControllerProps> = ({
  campaign,
  rewards,
  onRefresh,
}) => {
  const { sessionToken } = useMerchantAuth();
  const [selectedRewardId, setSelectedRewardId] = useState<string>(rewards[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const pinnedReward = campaign.next_prize_override_reward_id
    ? rewards.find(r => r.id === campaign.next_prize_override_reward_id)
    : null;

  // Next 10 prizes in sequence
  const queue: PrizeQueueItem[] = campaign.prize_queue || [];
  const next10 = queue.slice(0, 10);

  const handleSetNextPrize = async () => {
    if (!selectedRewardId || !sessionToken) return;
    setIsSubmitting(true);
    setActionSuccess(null);
    try {
      await setNextPrizeSecureRpc(sessionToken, campaign.id, selectedRewardId);
      const msg = 'Next prize pinned successfully!';
      setActionSuccess(msg);
      toast.success(msg);
      await onRefresh();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to pin next prize');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleClearNextPrize = async () => {
    if (!sessionToken) return;
    setIsSubmitting(true);
    setActionSuccess(null);
    try {
      await clearNextPrizeSecureRpc(sessionToken, campaign.id);
      const msg = 'Next prize override cleared. Regular queue restored.';
      setActionSuccess(msg);
      toast.success(msg);
      await onRefresh();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to clear override');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleReshuffleQueue = async () => {
    setIsSubmitting(true);
    setActionSuccess(null);
    try {
      await reshufflePrizeQueueRpc(campaign.id);
      const msg = 'Prize queue reshuffled while respecting probability distribution!';
      setActionSuccess(msg);
      toast.success(msg);
      await onRefresh();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to reshuffle queue');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-soft space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-coral-brand/10 text-coral-brand flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Prize Pool & Queue Controller</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Control exact customer win outcomes or monitor upcoming queue distribution in real-time.
          </p>
        </div>

        <button
          onClick={handleReshuffleQueue}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-brand bg-teal-brand/10 hover:bg-teal-brand/15 rounded-lg transition"
          title="Reshuffle the future prize queue randomly according to probability weights"
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>Reshuffle Queue</span>
        </button>
      </div>

      {/* Success Banner */}
      {actionSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Force / Pin Next Prize Controller */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-coral-brand" />
            Set Next Prize (Instant Win Override)
          </span>
          {pinnedReward && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-coral-light text-coral-brand border border-coral-brand/30 animate-pulse">
              ⚡ OVERRIDE ACTIVE
            </span>
          )}
        </div>

        {pinnedReward ? (
          <div className="bg-coral-light/60 border border-coral-brand/30 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-coral-brand">
                Pinned for the very next player: <span className="underline">{pinnedReward.reward_name}</span>
              </p>
              <p className="text-[11px] text-slate-600">
                The next customer who scratches is guaranteed this reward. The override will automatically reset after the win.
              </p>
            </div>
            <button
              onClick={handleClearNextPrize}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold shadow-sm transition"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              Cancel Override
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedRewardId}
              onChange={(e) => setSelectedRewardId(e.target.value)}
              className="flex-1 min-w-[220px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-brand/40 text-slate-800 font-medium"
            >
              {rewards.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reward_name} ({r.probability_percentage}% probability)
                </option>
              ))}
            </select>
            <button
              onClick={handleSetNextPrize}
              disabled={isSubmitting || !selectedRewardId}
              className="flex items-center gap-1.5 px-4 py-2 bg-coral-brand hover:bg-coral-hover text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Pin as Next Prize</span>
            </button>
          </div>
        )}
      </div>

      {/* Upcoming 10 Prizes Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Upcoming 10 Prizes in Queue
          </h4>
          <span className="text-[11px] text-slate-400 font-mono">
            Total Queue Pool: {queue.length} items
          </span>
        </div>

        {next10.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <AlertCircle className="w-6 h-6 mx-auto mb-1 text-slate-300" />
            Prize queue is empty. Click "Reshuffle Queue" to regenerate according to probability rules.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {next10.map((item, idx) => {
              const isNext = idx === 0 && !pinnedReward;
              return (
                <div
                  key={`${item.reward_id}-${idx}`}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    idx === 0
                      ? 'bg-teal-50 border-teal-brand/40 ring-2 ring-teal-brand/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
                    <span className={idx === 0 ? 'text-teal-brand font-bold' : ''}>
                      {idx === 0 ? '👉 #1 NEXT' : `#${idx + 1}`}
                    </span>
                    <span className="font-mono text-slate-300">
                      #{item.win_code_prefix}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                    {item.reward_name}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
