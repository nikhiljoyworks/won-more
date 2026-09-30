import React, { useState, useEffect } from 'react';
import { X, Gift, Zap, Clock, Check, AlertCircle } from 'lucide-react';
import { Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { toast } from '../../context/ToastContext';

interface EditCampaignPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prize: Reward | null;
  campaignId: string;
  onSaved: () => Promise<void> | void;
}

export const EditCampaignPrizeModal: React.FC<EditCampaignPrizeModalProps> = ({
  isOpen,
  onClose,
  prize,
  campaignId,
  onSaved,
}) => {
  const [allocatedQty, setAllocatedQty] = useState<number>(prize?.allocated_qty ?? 100);
  const [dailyLimit, setDailyLimit] = useState<number>(prize?.daily_limit ?? 10);
  const [hourlyLimit, setHourlyLimit] = useState<number>(prize?.hourly_limit ?? 2);
  const [weight, setWeight] = useState<number>(prize?.weight ?? 20);
  const [isActive, setIsActive] = useState<boolean>(prize?.is_active ?? true);
  const [autoPacing, setAutoPacing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (prize) {
      setAllocatedQty(prize.allocated_qty ?? 100);
      setDailyLimit(prize.daily_limit ?? 10);
      setHourlyLimit(prize.hourly_limit ?? 2);
      setWeight(prize.weight ?? 20);
      setIsActive(prize.is_active ?? true);
      setAutoPacing(false);
    }
  }, [prize]);

  if (!isOpen || !prize) return null;

  const remainingQty = Math.max(0, allocatedQty - (prize.supplied_qty || 0));

  const handleQtyChange = (val: number) => {
    const qty = Math.max(1, val);
    setAllocatedQty(qty);
    if (autoPacing) {
      const d = Math.max(1, Math.round(qty / 10));
      setDailyLimit(d);
      setHourlyLimit(Math.max(1, Math.round(d / 5)));
    }
  };

  const applyPreset = (preset: 'rare' | 'standard' | 'frequent') => {
    if (preset === 'rare') {
      setAllocatedQty(10);
      setDailyLimit(1);
      setHourlyLimit(1);
      setWeight(5);
      setAutoPacing(false);
    } else if (preset === 'standard') {
      setAllocatedQty(100);
      setDailyLimit(10);
      setHourlyLimit(2);
      setWeight(20);
      setAutoPacing(true);
    } else {
      setAllocatedQty(500);
      setDailyLimit(50);
      setHourlyLimit(10);
      setWeight(45);
      setAutoPacing(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('rewards')
        .update({
          allocated_qty: Number(allocatedQty),
          max_limit: Number(allocatedQty),
          daily_limit: Number(dailyLimit),
          hourly_limit: Number(hourlyLimit),
          weight: Number(weight),
          probability_percentage: Number(weight),
          is_active: isActive,
        })
        .eq('id', prize.id);

      if (error) throw error;

      await reshufflePrizeQueueRpc(campaignId);
      toast.success(`Updated quotas for "${prize.reward_name}"!`);
      await onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to update prize');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden">
      <div className="bg-[#121B28] text-slate-100 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-700/60 relative animate-fadeIn overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Adjust Prize Quotas & Limits
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configuring live campaign limits for <span className="text-white font-bold">{prize.reward_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="edit-quotas-form" onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* Quick Presets */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              QUICK DISTRIBUTION PRESETS:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('rare')}
                className="p-2 rounded-xl border border-slate-700 bg-[#1A2634] hover:border-amber-400 text-left transition"
              >
                <p className="font-bold text-amber-300 text-[11px]">⭐ Grand Prize</p>
                <p className="text-[9px] text-slate-400 mt-0.5">10 total • 1/day • 5% odds</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className="p-2 rounded-xl border border-slate-700 bg-[#1A2634] hover:border-teal-400 text-left transition"
              >
                <p className="font-bold text-teal-300 text-[11px]">🎁 Standard</p>
                <p className="text-[9px] text-slate-400 mt-0.5">100 total • 10/day • 20% odds</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('frequent')}
                className="p-2 rounded-xl border border-slate-700 bg-[#1A2634] hover:border-coral-brand text-left transition"
              >
                <p className="font-bold text-coral-brand text-[11px]">🎉 Frequent</p>
                <p className="text-[9px] text-slate-400 mt-0.5">500 total • 50/day • 45% odds</p>
              </button>
            </div>
          </div>

          {/* Total Stock & Stats Box */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2">
              <span className="font-bold uppercase text-slate-300">Inventory Status:</span>
              <span className="font-bold text-teal-400 font-mono">
                Given Away: {prize.supplied_qty || 0} / {allocatedQty} (Remaining: {remainingQty})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  TOTAL ALLOCATED STOCK <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  min={Math.max(1, prize.supplied_qty || 0)}
                  value={allocatedQty}
                  onChange={(e) => handleQtyChange(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  PROBABILITY ODDS (1-100) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={weight}
                  onChange={(e) => setWeight(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-amber-400 font-extrabold outline-none focus:border-amber-400 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Daily & Hourly Protection Limits */}
          <div className="p-3 bg-[#1A2634] border border-slate-700/80 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Burn Rate Protection
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-teal-300 font-semibold">
                <input
                  type="checkbox"
                  checked={autoPacing}
                  onChange={(e) => {
                    setAutoPacing(e.target.checked);
                    if (e.target.checked) handleQtyChange(allocatedQty);
                  }}
                  className="w-3.5 h-3.5 rounded text-teal-500 bg-slate-900 border-slate-700"
                />
                <span>⚡ Auto-Pace</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  MAX WINNERS / DAY
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={autoPacing}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs outline-none disabled:opacity-60"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5">Cap per calendar day</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  MAX WINNERS / HOUR
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={autoPacing}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs outline-none disabled:opacity-60"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5">Cap per rolling hour</span>
              </div>
            </div>
          </div>

          {/* Active Status Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-teal-500 bg-slate-800 border-slate-700"
            />
            <span>Prize is Active in Queue (Can be won by customers)</span>
          </label>

        </form>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-800 bg-[#121B28] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-quotas-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Quotas'}
          </button>
        </div>

      </div>
    </div>
  );
};
