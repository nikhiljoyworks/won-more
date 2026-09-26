import React, { useState } from 'react';
import { X, Gift, Plus, Trash2, CheckCircle2, AlertTriangle, Percent } from 'lucide-react';
import { Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { toast } from '../../context/ToastContext';

interface RewardConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  initialRewards: Reward[];
  onSaved: () => Promise<void>;
}

interface EditableReward {
  id?: string;
  reward_name: string;
  probability_percentage: number;
  win_code_prefix: string;
}

export const RewardConfigModal: React.FC<RewardConfigModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  initialRewards,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [rewards, setRewards] = useState<EditableReward[]>(
    initialRewards.length > 0
      ? initialRewards.map(r => ({
          id: r.id,
          reward_name: r.reward_name,
          probability_percentage: r.probability_percentage ?? r.weight ?? 10,
          win_code_prefix: r.win_code_prefix || 'WIN',
        }))
      : [
          { reward_name: 'Free Beverage', probability_percentage: 20, win_code_prefix: 'FREE' },
          { reward_name: '15% Off Total Bill', probability_percentage: 30, win_code_prefix: 'DISC' },
          { reward_name: 'Better Luck Next Time', probability_percentage: 50, win_code_prefix: 'TRY' },
        ]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalProbability = rewards.reduce((sum, r) => sum + (Number(r.probability_percentage) || 0), 0);
  const isStrictly100 = totalProbability === 100;

  const handleChange = (index: number, field: keyof EditableReward, value: string | number) => {
    const updated = [...rewards];
    updated[index] = { ...updated[index], [field]: value };
    setRewards(updated);
  };

  const addReward = () => {
    setRewards([
      ...rewards,
      { reward_name: 'Special Reward', probability_percentage: 0, win_code_prefix: 'WIN' },
    ]);
  };

  const removeReward = (index: number) => {
    if (rewards.length <= 1) {
      toast.warning('You must have at least one reward.');
      return;
    }
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrictly100) {
      const err = `Total probability must strictly equal 100%. Currently: ${totalProbability}%.`;
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // 1. Delete existing rewards for this campaign and re-insert
      const { error: delErr } = await supabase
        .from('rewards')
        .delete()
        .eq('campaign_id', campaignId);

      if (delErr) throw delErr;

      // 2. Insert new rewards
      const toInsert = rewards.map(r => ({
        campaign_id: campaignId,
        reward_name: r.reward_name.trim(),
        probability_percentage: Number(r.probability_percentage),
        win_code_prefix: (r.win_code_prefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, ''),
      }));

      const { error: insErr } = await supabase.from('rewards').insert(toInsert);
      if (insErr) throw insErr;

      // 3. Replenish prize queue in Supabase so queue matches new rewards
      await reshufflePrizeQueueRpc(campaignId);

      await onSaved();
      toast.success('Prizes and probability distribution saved!');
      onClose();
    } catch (err: unknown) {
      const errTxt = (err as Error).message || 'Failed to save rewards configuration';
      setErrorMsg(errTxt);
      toast.error(errTxt);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-coral-brand/10 text-coral-brand flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Reward Configuration</h3>
              <p className="text-xs text-slate-500">Configure prizes & probability weights (Must strictly equal 100%)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Probability Meter */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-teal-brand" />
              Total Winning Probability
            </span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                isStrictly100
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-coral-light text-coral-brand border border-coral-brand/30'
              }`}
            >
              {totalProbability}% / 100% {isStrictly100 ? '✅ Valid' : '⚠️ Must be 100%'}
            </span>
          </div>

          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 ${
                isStrictly100 ? 'bg-emerald-500' : totalProbability > 100 ? 'bg-red-500' : 'bg-coral-brand'
              }`}
              style={{ width: `${Math.min(totalProbability, 100)}%` }}
            />
          </div>

          {!isStrictly100 && (
            <p className="text-[11px] text-coral-brand flex items-center gap-1 pt-1 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {totalProbability < 100
                ? `Add ${100 - totalProbability}% more to reach exactly 100%.`
                : `Reduce ${totalProbability - 100}% to reach exactly 100%.`}
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {rewards.map((r, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap sm:flex-nowrap items-center gap-2.5"
              >
                {/* Reward Name */}
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                    Prize Name
                  </label>
                  <input
                    type="text"
                    required
                    value={r.reward_name}
                    onChange={(e) => handleChange(idx, 'reward_name', e.target.value)}
                    placeholder="e.g. Free Coffee"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-brand font-medium text-slate-800"
                  />
                </div>

                {/* Probability % */}
                <div className="w-24">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                    Chance (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={r.probability_percentage}
                      onChange={(e) => handleChange(idx, 'probability_percentage', parseInt(e.target.value) || 0)}
                      className="w-full pl-2.5 pr-6 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-brand font-bold text-slate-900"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-semibold">%</span>
                  </div>
                </div>

                {/* Win Code Prefix */}
                <div className="w-24">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                    Code Prefix
                  </label>
                  <input
                    type="text"
                    value={r.win_code_prefix}
                    maxLength={8}
                    onChange={(e) => handleChange(idx, 'win_code_prefix', e.target.value.toUpperCase())}
                    placeholder="WIN"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-brand font-mono font-bold text-teal-brand uppercase"
                  />
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeReward(idx)}
                  className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addReward}
            className="w-full py-2 border-2 border-dashed border-slate-200 hover:border-coral-brand/40 text-slate-600 hover:text-coral-brand rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Add Another Prize
          </button>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !isStrictly100}
              className="px-5 py-2.5 bg-coral-brand hover:bg-coral-hover text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save & Update Prize Pool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
