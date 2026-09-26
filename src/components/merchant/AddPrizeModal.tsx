import React, { useState, useEffect } from 'react';
import { X, Gift, Upload, Image as ImageIcon, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Campaign, Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { resizeImageFile } from '../../lib/utils';
import { toast } from '../../context/ToastContext';
import { uploadImageToR2 } from '../../lib/r2';

interface AddPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  selectedCampaignId?: string;
  existingPrizes?: Reward[];
  prizeToEdit?: Reward | null;
  onSaved: () => Promise<void>;
}

export const AddPrizeModal: React.FC<AddPrizeModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  selectedCampaignId,
  existingPrizes = [],
  prizeToEdit = null,
  onSaved,
}) => {
  if (!isOpen) return null;

  const defaultCampId = selectedCampaignId || campaigns[0]?.id || '';
  const [targetCampaignId, setTargetCampaignId] = useState<string>(
    prizeToEdit?.campaign_id || defaultCampId
  );

  const [prizeName, setPrizeName] = useState(prizeToEdit?.reward_name || '');
  const [imageUrl, setImageUrl] = useState(prizeToEdit?.image_url || '');
  const [description, setDescription] = useState(prizeToEdit?.description || '');
  const [winCodePrefix, setWinCodePrefix] = useState(prizeToEdit?.win_code_prefix || 'WIN');
  
  // Inventory & Limits
  const [allocatedQty, setAllocatedQty] = useState<number>(prizeToEdit?.allocated_qty ?? 100);
  const [suppliedQty, setSuppliedQty] = useState<number>(prizeToEdit?.supplied_qty ?? 0);
  const [maxLimit, setMaxLimit] = useState<number>(prizeToEdit?.max_limit ?? 100);
  const [dailyLimit, setDailyLimit] = useState<number>(prizeToEdit?.daily_limit ?? 50);
  const [hourlyLimit, setHourlyLimit] = useState<number>(prizeToEdit?.hourly_limit ?? 10);
  const [weight, setWeight] = useState<number>(prizeToEdit?.weight ?? 10);
  const [displayOrder, setDisplayOrder] = useState<number>(prizeToEdit?.display_order ?? 0);
  const [isActive, setIsActive] = useState<boolean>(prizeToEdit?.is_active ?? true);

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Template / Existing Prize Selector
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const remainingQty = Math.max(0, allocatedQty - suppliedQty);

  // Unique existing prizes for picking from already added prize list
  const uniqueLibraryPrizes = Array.from(
    new Map(existingPrizes.map((p) => [p.reward_name.toLowerCase(), p])).values()
  );

  const handlePickExisting = (rewardName: string) => {
    setSelectedTemplate(rewardName);
    const found = existingPrizes.find(
      (p) => p.reward_name.toLowerCase() === rewardName.toLowerCase()
    );
    if (found) {
      setPrizeName(found.reward_name);
      setImageUrl(found.image_url || '');
      setDescription(found.description || '');
      setWinCodePrefix(found.win_code_prefix || 'WIN');
      setAllocatedQty(found.allocated_qty || 100);
      setWeight(found.weight || 10);
      setMaxLimit(found.max_limit || 100);
      setDailyLimit(found.daily_limit || 50);
      setHourlyLimit(found.hourly_limit || 10);
    }
  };

  // Drag and Drop File Handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    try {
      const publicUrl = await uploadImageToR2(file, {
        folder: 'prizes',
        namePrefix: prizeName || 'prize',
        maxWidth: 400,
        maxHeight: 400,
      });
      setImageUrl(publicUrl);
      toast.success('Prize image uploaded to Cloudflare R2!');
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prizeName.trim()) {
      setErrorMsg('Prize name is required.');
      return;
    }
    if (!targetCampaignId) {
      setErrorMsg('Please select a target campaign.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const cleanPrefix = (winCodePrefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (prizeToEdit) {
        // Update existing reward
        const { error } = await supabase
          .from('rewards')
          .update({
            campaign_id: targetCampaignId,
            reward_name: prizeName.trim(),
            image_url: imageUrl.trim() || null,
            description: description.trim() || null,
            win_code_prefix: cleanPrefix,
            allocated_qty: Number(allocatedQty),
            supplied_qty: Number(suppliedQty),
            max_limit: Number(maxLimit),
            daily_limit: Number(dailyLimit),
            hourly_limit: Number(hourlyLimit),
            weight: Number(weight),
            probability_percentage: Number(weight), // Keep backward compatible
            display_order: Number(displayOrder),
            is_active: isActive,
          })
          .eq('id', prizeToEdit.id);

        if (error) throw error;
      } else {
        // Insert new reward
        const { error } = await supabase.from('rewards').insert({
          campaign_id: targetCampaignId,
          reward_name: prizeName.trim(),
          image_url: imageUrl.trim() || null,
          description: description.trim() || null,
          win_code_prefix: cleanPrefix,
          allocated_qty: Number(allocatedQty),
          supplied_qty: 0,
          max_limit: Number(maxLimit),
          daily_limit: Number(dailyLimit),
          hourly_limit: Number(hourlyLimit),
          weight: Number(weight),
          probability_percentage: Number(weight),
          display_order: Number(displayOrder),
          is_active: isActive,
        });

        if (error) throw error;
      }

      // Replenish prize queue for the target campaign
      await reshufflePrizeQueueRpc(targetCampaignId);

      await onSaved();
      toast.success(prizeToEdit ? 'Prize updated successfully!' : 'Prize added to campaign pool!');
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to save prize';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121B28] text-slate-100 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-700/60 relative my-8 animate-fadeIn">
        
        {/* Header matching user screenshot */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {prizeToEdit ? 'Edit Prize' : 'Add New Prize'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure prize details, inventory quotas, daily/hourly limits, and winning probability weight.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          
          {/* Quick pick from already added prize list */}
          {uniqueLibraryPrizes.length > 0 && !prizeToEdit && (
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
              <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Pick from Existing Prize Library
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handlePickExisting(e.target.value)}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-slate-200 font-medium outline-none focus:border-amber-400"
              >
                <option value="">-- Choose an existing prize to auto-fill --</option>
                {uniqueLibraryPrizes.map((p) => (
                  <option key={p.id} value={p.reward_name}>
                    {p.reward_name} (Weight: {p.weight})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* TARGET CAMPAIGN */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              TARGET CAMPAIGN
            </label>
            <select
              value={targetCampaignId}
              onChange={(e) => setTargetCampaignId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-semibold outline-none focus:border-amber-400 transition"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title.toUpperCase()} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          {/* PRIZE NAME & IMAGE URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                PRIZE NAME <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Gift className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={prizeName}
                  onChange={(e) => setPrizeName(e.target.value)}
                  placeholder="e.g. ₹300 Cashback"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-medium outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                PRIZE IMAGE URL (OR DRAG & DROP)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://.../prize.png"
                  className="w-full pl-3 pr-10 py-2.5 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-mono text-[11px] outline-none focus:border-amber-400"
                />
                <label className="absolute right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-3 text-center transition ${
              isDragging
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600'
            }`}
          >
            {imageUrl ? (
              <div className="flex items-center justify-center gap-3">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-700 shadow-md"
                />
                <div className="text-left text-[11px]">
                  <p className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Image Loaded
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Drag another file here or click upload to replace
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px]">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Drag & drop prize image here, or upload from computer</span>
              </div>
            )}
          </div>

          {/* DESCRIPTION / COUPON CODE */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              DESCRIPTION / COUPON CODE
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, promo codes, or terms..."
              className="w-full px-3.5 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-white outline-none focus:border-amber-400 resize-none font-medium"
            />
          </div>

          {/* INVENTORY & LIMITS BOX (Yellow border/header matching screenshot) */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>🧮</span> INVENTORY & LIMITS
              </span>
              <span className="font-mono font-bold text-amber-400 text-[11px]">
                Remaining: {remainingQty}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  ALLOCATED QTY <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={allocatedQty}
                  onChange={(e) => setAllocatedQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  SUPPLIED (GIVEN)
                </label>
                <input
                  type="number"
                  readOnly
                  value={suppliedQty}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-400 font-bold outline-none cursor-not-allowed"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5">Auto-tracked on win</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  MAXIMUM LIMIT
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none focus:border-amber-400"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5">Absolute cap</span>
              </div>
            </div>
          </div>

          {/* DAILY LIMIT, HOURLY LIMIT, WEIGHT (ODDS) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                DAILY LIMIT
              </label>
              <input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none focus:border-amber-400"
              />
              <span className="text-[9px] text-slate-500 block mt-0.5">Max per calendar day</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                HOURLY LIMIT
              </label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none focus:border-amber-400"
              />
              <span className="text-[9px] text-slate-500 block mt-0.5">Max per rolling hour</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                WEIGHT (ODDS) <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-amber-400 font-extrabold outline-none focus:border-amber-400 text-sm"
              />
              <span className="text-[9px] text-slate-500 block mt-0.5">Higher = more likely</span>
            </div>
          </div>

          {/* DISPLAY ORDER & ACTIVE CHECKBOX */}
          <div className="flex items-center justify-between pt-1">
            <div className="w-32">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                DISPLAY ORDER
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-lg text-white font-bold outline-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-4 text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-700"
              />
              <span>Prize is Active & Available</span>
            </label>
          </div>

          {/* Modal Actions matching user screenshot */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : prizeToEdit ? 'Update Prize' : 'Add Prize'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
