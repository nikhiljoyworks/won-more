import React, { useState, useEffect } from 'react';
import { X, Gift, Zap, Clock, Check, AlertCircle, Ticket, Upload, Image as ImageIcon, Trash2, Tag } from 'lucide-react';
import { Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { toast } from '../../context/ToastContext';
import { uploadImageToR2 } from '../../lib/r2';

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
  const { shop } = useMerchantAuth();

  // Prize Metadata State
  const [rewardName, setRewardName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');
  const [winCodePrefix, setWinCodePrefix] = useState<string>('WIN');
  
  // Quotas & Odds State
  const [allocatedQty, setAllocatedQty] = useState<number>(100);
  const [dailyLimit, setDailyLimit] = useState<number>(10);
  const [hourlyLimit, setHourlyLimit] = useState<number>(2);
  const [weight, setWeight] = useState<number>(20);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [autoPacing, setAutoPacing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (prize) {
      setRewardName(prize.reward_name ?? '');
      setDescription(prize.description ?? '');
      setImageUrl(prize.image_url ?? '');
      setWinCodePrefix(prize.win_code_prefix ?? 'WIN');
      setCouponCode(prize.coupon_code ?? '');
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    setIsUploading(true);
    try {
      const publicUrl = await uploadImageToR2(file, {
        folder: 'prizes',
        namePrefix: rewardName || 'prize',
        maxWidth: 800,
        maxHeight: 600,
        maxSizeBytes: 250 * 1024,
      });
      setImageUrl(publicUrl);
      toast.success('Prize image uploaded!');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
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
    if (!rewardName.trim()) {
      toast.error('Prize name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPrefix = (winCodePrefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanCoupon = couponCode.trim().toUpperCase();

      // 1. Update Campaign Reward
      const { error } = await supabase
        .from('rewards')
        .update({
          reward_name: rewardName.trim(),
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          coupon_code: cleanCoupon || null,
          win_code_prefix: cleanPrefix,
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

      // 2. Also keep Master Catalog in sync if a prize with matching name exists in store catalog
      if (shop?.id) {
        await supabase
          .from('shop_prizes')
          .update({
            name: rewardName.trim(),
            description: description.trim() || null,
            image_url: imageUrl.trim() || null,
            coupon_code: cleanCoupon || null,
            win_code_prefix: cleanPrefix,
            updated_at: new Date().toISOString(),
          })
          .eq('shop_id', shop.id)
          .or(`name.ilike.${encodeURIComponent(prize.reward_name)},name.ilike.${encodeURIComponent(rewardName.trim())}`);
      }

      // 3. Immediately reshuffle campaign queue so scratches get new description immediately
      await reshufflePrizeQueueRpc(campaignId);

      toast.success(`Updated prize details & quotas for "${rewardName.trim()}"!`);
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
              <Gift className="w-5 h-5 text-amber-400" />
              Edit Prize Details & Quotas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live campaign configuration for <span className="text-white font-bold">{prize.reward_name}</span>
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
          
          {/* Section 1: Prize Metadata (Name, Description, Image) */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
              Prize Details & Voucher Description
            </h4>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Prize Title / Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={rewardName}
                onChange={(e) => setRewardName(e.target.value)}
                placeholder="e.g. ₹500 OFF, Free Cappuccino"
                required
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none focus:border-amber-400 text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Terms, Conditions & Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Valid on purchase above ₹6000. Cannot combine with other offers. Maximum discount up to ₹500"
                rows={3}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-amber-400 text-xs resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                This description is displayed to customers under the scratch card upon winning and in their voucher claim.
              </p>
            </div>

            {/* Image Preview & Upload */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                Prize Image
              </label>
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <div className="relative w-16 h-14 bg-[#1A2634] rounded-lg border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center p-1">
                    <img src={imageUrl} alt="Prize" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-14 bg-[#1A2634] rounded-lg border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer font-semibold text-[11px] transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[9px] text-slate-500">PNG, JPG, WebP up to 250KB</p>
                </div>
              </div>
            </div>

            {/* Ticket Prefix & Coupon Code */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Ticket Prefix
                </label>
                <input
                  type="text"
                  value={winCodePrefix}
                  onChange={(e) => setWinCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="WIN"
                  maxLength={10}
                  className="w-full px-2.5 py-1.5 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="e.g. TANOAH500"
                  maxLength={20}
                  className="w-full px-2.5 py-1.5 bg-[#1A2634] border border-slate-700 focus:border-amber-400 rounded-lg text-amber-300 font-mono font-bold text-xs outline-none uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quick Presets */}
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

          {/* Section 3: Total Stock & Stats Box */}
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

          {/* Section 4: Daily & Hourly Protection Limits */}
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

          {/* Section 5: Active Status Checkbox */}
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
            disabled={isSubmitting || isUploading}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Prize Details'}
          </button>
        </div>

      </div>
    </div>
  );
};
