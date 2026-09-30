import React, { useState, useEffect } from 'react';
import { X, Gift, Sparkles, Plus, Check, Clock, Calendar, Zap, AlertCircle } from 'lucide-react';
import { ShopPrize } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { toast } from '../../context/ToastContext';
import { AddPrizeModal } from './AddPrizeModal';

interface PickCatalogPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  campaignId: string;
  campaignTitle?: string;
  existingRewardNames?: string[];
  onPrizeAdded: () => Promise<void> | void;
}

export const PickCatalogPrizeModal: React.FC<PickCatalogPrizeModalProps> = ({
  isOpen,
  onClose,
  shopId,
  campaignId,
  campaignTitle = 'this campaign',
  existingRewardNames = [],
  onPrizeAdded,
}) => {
  const [catalogPrizes, setCatalogPrizes] = useState<ShopPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrize, setSelectedPrize] = useState<ShopPrize | null>(null);

  // Quota & Pacing Form State
  const [allocatedQty, setAllocatedQty] = useState<number>(100);
  const [dailyLimit, setDailyLimit] = useState<number>(10);
  const [hourlyLimit, setHourlyLimit] = useState<number>(2);
  const [weight, setWeight] = useState<number>(20);
  const [autoPacing, setAutoPacing] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-modal for creating a new master prize
  const [isCreateMasterOpen, setIsCreateMasterOpen] = useState(false);

  const fetchCatalog = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shop_prizes')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCatalogPrizes(data || []);
      if (data && data.length > 0 && !selectedPrize) {
        // Find first prize not yet in campaign
        const available = data.find(
          (p) => !existingRewardNames.some((en) => en.toLowerCase() === p.name.toLowerCase())
        );
        setSelectedPrize(available || data[0]);
      }
    } catch (err) {
      console.error('Failed to load shop prizes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCatalog();
    }
  }, [isOpen, shopId]);

  // Handle auto-pacing calculations
  const handleQtyChange = (qty: number) => {
    const val = Math.max(1, qty);
    setAllocatedQty(val);
    if (autoPacing) {
      const dLimit = Math.max(1, Math.round(val / 10));
      setDailyLimit(dLimit);
      setHourlyLimit(Math.max(1, Math.round(dLimit / 5)));
    }
  };

  // 1-Click Preset Buttons
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

  const handleAddPrizeToCampaign = async () => {
    if (!selectedPrize) {
      toast.error('Please select a prize from your catalog');
      return;
    }
    if (!campaignId) {
      toast.error('Campaign ID is missing');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPrefix = (selectedPrize.win_code_prefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const { error } = await supabase.from('rewards').insert({
        campaign_id: campaignId,
        reward_name: selectedPrize.name.trim(),
        image_url: selectedPrize.image_url || null,
        description: selectedPrize.description || null,
        coupon_code: selectedPrize.coupon_code || null,
        win_code_prefix: cleanPrefix,
        allocated_qty: Number(allocatedQty) || 100,
        supplied_qty: 0,
        max_limit: Number(allocatedQty) || 100,
        daily_limit: Number(dailyLimit) || 10,
        hourly_limit: Number(hourlyLimit) || 2,
        weight: Number(weight) || 20,
        probability_percentage: Number(weight) || 20,
        display_order: 0,
        is_active: true,
      });

      if (error) throw error;

      await reshufflePrizeQueueRpc(campaignId);
      toast.success(`"${selectedPrize.name}" added to ${campaignTitle}!`);
      await onPrizeAdded();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to add prize to campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden">
      <div className="bg-[#121B28] text-slate-100 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-700/60 relative animate-fadeIn overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Gift className="w-5 h-5 text-coral-brand" />
              Pick Prize from Your Store Catalog
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any prize from your master library and set its winning quotas for <span className="text-teal-400 font-semibold">{campaignTitle}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {/* Catalog Selector Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                1. Select Master Prize
              </label>
              <button
                type="button"
                onClick={() => setIsCreateMasterOpen(true)}
                className="text-[11px] font-bold text-coral-brand hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create New Prize
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                Loading your store prizes...
              </div>
            ) : catalogPrizes.length === 0 ? (
              <div className="p-6 text-center bg-slate-900/50 rounded-xl border border-dashed border-slate-800 space-y-2">
                <Gift className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-slate-300 font-medium">Your Prize Catalog is Empty</p>
                <p className="text-slate-500 text-[11px]">
                  Create your first master prize (e.g. 20% Off, ₹500 Cashback) to get started.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateMasterOpen(true)}
                  className="px-4 py-2 bg-coral-brand text-white font-bold rounded-xl text-xs hover:bg-coral-hover transition"
                >
                  + Create Master Prize Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {catalogPrizes.map((p) => {
                  const isAlreadyInCamp = existingRewardNames.some(
                    (en) => en.toLowerCase() === p.name.toLowerCase()
                  );
                  const isSelected = selectedPrize?.id === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isAlreadyInCamp && setSelectedPrize(p)}
                      className={`p-3 rounded-xl border transition flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-coral-brand/10 border-coral-brand ring-1 ring-coral-brand/30'
                          : isAlreadyInCamp
                          ? 'bg-slate-900/30 border-slate-800 opacity-60 cursor-not-allowed'
                          : 'bg-[#1A2634] border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-contain bg-slate-950 border border-slate-800 shrink-0 p-0.5"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                          <Gift className="w-5 h-5 text-amber-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate text-xs">{p.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {p.coupon_code ? `Code: ${p.coupon_code}` : `Prefix: ${p.win_code_prefix || 'WIN'}`}
                        </p>
                      </div>

                      {isAlreadyInCamp ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                          Added
                        </span>
                      ) : isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-coral-brand text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User-Friendly Quotas & Limits Configuration */}
          {selectedPrize && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 text-xs">
                  <Zap className="w-4 h-4 text-amber-400" />
                  2. Easy Quota & Limit Settings
                </span>
                <span className="text-[11px] text-teal-400 font-semibold truncate max-w-[200px]">
                  Configuring: {selectedPrize.name}
                </span>
              </div>

              {/* 1-Click Quick Presets */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Quick Distribution Presets (1-Click Setup):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('rare')}
                    className="p-2 rounded-xl border border-slate-700 bg-[#1A2634] hover:border-amber-400 text-left transition group"
                  >
                    <p className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                      ⭐ Grand Prize
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">10 total • 1/day • 5% odds</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('standard')}
                    className="p-2 rounded-xl border border-slate-700 bg-[#1A2634] hover:border-teal-400 text-left transition group"
                  >
                    <p className="font-bold text-teal-300 text-[11px] flex items-center gap-1">
                      🎁 Standard
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">100 total • 10/day • 20% odds</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('frequent')}
                    className="p-2 rounded-xl border border-slate-700 bg-[#1A2634] hover:border-coral-brand text-left transition group"
                  >
                    <p className="font-bold text-coral-brand text-[11px] flex items-center gap-1">
                      🎉 Frequent
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">500 total • 50/day • 45% odds</p>
                  </button>
                </div>
              </div>

              {/* Total Stock Input & Auto-Pacing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    TOTAL STOCK TO GIVE AWAY <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={allocatedQty}
                    onChange={(e) => handleQtyChange(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-amber-400 text-xs"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">
                    Total winning prizes available for this campaign
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    WINNING PROBABILITY ODDS (1-100) <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={weight}
                    onChange={(e) => setWeight(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-amber-400 font-extrabold outline-none focus:border-amber-400 text-xs"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">
                    Higher weight relative to other prizes = won more often
                  </span>
                </div>
              </div>

              {/* Daily & Hourly Protection Limits */}
              <div className="p-3 bg-[#1A2634]/70 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    Pacing & Burn Rate Protection
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
                    <span>⚡ Auto-Calculate</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      MAX WINNERS PER DAY
                    </label>
                    <input
                      type="number"
                      min={1}
                      disabled={autoPacing}
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs outline-none disabled:opacity-60"
                    />
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      Prevents giving all away on Day 1
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      MAX WINNERS PER HOUR
                    </label>
                    <input
                      type="number"
                      min={1}
                      disabled={autoPacing}
                      value={hourlyLimit}
                      onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs outline-none disabled:opacity-60"
                    />
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      Protects against sudden customer rushes
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

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
            type="button"
            disabled={!selectedPrize || isSubmitting}
            onClick={handleAddPrizeToCampaign}
            className="px-6 py-2.5 bg-gradient-to-r from-coral-brand to-coral-hover text-white font-bold rounded-xl text-xs shadow-lg shadow-coral-brand/20 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? 'Adding...' : `Add to ${campaignTitle}`}
          </button>
        </div>

      </div>

      {/* Sub-modal to create master prize directly if needed */}
      {isCreateMasterOpen && (
        <AddPrizeModal
          isOpen={isCreateMasterOpen}
          onClose={() => setIsCreateMasterOpen(false)}
          shopId={shopId}
          onSaved={async () => {
            await fetchCatalog();
            setIsCreateMasterOpen(false);
          }}
        />
      )}
    </div>
  );
};
