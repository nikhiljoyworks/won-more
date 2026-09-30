import React, { useState, useEffect } from 'react';
import { X, Gift, Upload, Image as ImageIcon, Check, AlertCircle, Info, Tag } from 'lucide-react';
import { ShopPrize, Reward } from '../../types';
import { supabase, reshufflePrizeQueueRpc } from '../../lib/supabase';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { toast } from '../../context/ToastContext';
import { uploadImageToR2 } from '../../lib/r2';

interface AddPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
  currentCampaignId?: string;
  prizeToEdit?: ShopPrize | Reward | any | null;
  onSaved: () => Promise<void> | void;
}

export const AddPrizeModal: React.FC<AddPrizeModalProps> = ({
  isOpen,
  onClose,
  shopId: propShopId,
  currentCampaignId,
  prizeToEdit = null,
  onSaved,
}) => {
  const { shop } = useMerchantAuth();
  const effectiveShopId = propShopId || shop?.id;

  const [prizeName, setPrizeName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [winCodePrefix, setWinCodePrefix] = useState('WIN');
  const [attachToCurrentCampaign, setAttachToCurrentCampaign] = useState(Boolean(currentCampaignId));

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (prizeToEdit) {
        setPrizeName(prizeToEdit.name || prizeToEdit.reward_name || '');
        setImageUrl(prizeToEdit.image_url || '');
        setDescription(prizeToEdit.description || '');
        setCouponCode(prizeToEdit.coupon_code || '');
        setWinCodePrefix(prizeToEdit.win_code_prefix || 'WIN');
        setAttachToCurrentCampaign(false);
      } else {
        setPrizeName('');
        setImageUrl('');
        setDescription('');
        setCouponCode('');
        setWinCodePrefix('WIN');
        setAttachToCurrentCampaign(Boolean(currentCampaignId));
      }
      setErrorMsg(null);
    }
  }, [isOpen, prizeToEdit, currentCampaignId]);

  if (!isOpen) return null;

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
        maxWidth: 800,
        maxHeight: 600,
      });
      setImageUrl(publicUrl);
      toast.success('Prize image uploaded successfully!');
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
    if (!effectiveShopId) {
      setErrorMsg('Shop profile not found. Please log in.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const cleanPrefix = (winCodePrefix || 'WIN').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanCoupon = couponCode.trim().toUpperCase();

      if (prizeToEdit && prizeToEdit.id) {
        // If updating an existing catalog prize in shop_prizes
        const { error: spErr } = await supabase
          .from('shop_prizes')
          .update({
            name: prizeName.trim(),
            image_url: imageUrl.trim() || null,
            description: description.trim() || null,
            coupon_code: cleanCoupon || null,
            win_code_prefix: cleanPrefix,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prizeToEdit.id);

        if (spErr) throw spErr;

        // If prizeToEdit is also a campaign reward, update its metadata
        if (prizeToEdit.campaign_id) {
          await supabase
            .from('rewards')
            .update({
              reward_name: prizeName.trim(),
              image_url: imageUrl.trim() || null,
              description: description.trim() || null,
              coupon_code: cleanCoupon || null,
              win_code_prefix: cleanPrefix,
            })
            .eq('id', prizeToEdit.id);
        }
      } else {
        // 1. Insert into Master Prize Catalog (shop_prizes)
        const { error: spInsertErr } = await supabase
          .from('shop_prizes')
          .insert({
            shop_id: effectiveShopId,
            name: prizeName.trim(),
            image_url: imageUrl.trim() || null,
            description: description.trim() || null,
            coupon_code: cleanCoupon || null,
            win_code_prefix: cleanPrefix,
          });

        if (spInsertErr) throw spInsertErr;

        // 2. Optionally attach to currently active campaign if requested
        if (currentCampaignId && attachToCurrentCampaign) {
          const { error: rErr } = await supabase.from('rewards').insert({
            campaign_id: currentCampaignId,
            reward_name: prizeName.trim(),
            image_url: imageUrl.trim() || null,
            description: description.trim() || null,
            coupon_code: cleanCoupon || null,
            win_code_prefix: cleanPrefix,
            allocated_qty: 100,
            supplied_qty: 0,
            max_limit: 100,
            daily_limit: 20,
            hourly_limit: 5,
            weight: 20,
            probability_percentage: 20,
            display_order: 0,
            is_active: true,
          });

          if (!rErr) {
            await reshufflePrizeQueueRpc(currentCampaignId);
          }
        }
      }

      await onSaved();
      toast.success(prizeToEdit ? 'Prize updated in catalog!' : 'Prize saved to Master Catalog!');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden">
      <div className="bg-[#121B28] text-slate-100 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-700/60 relative animate-fadeIn overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              {prizeToEdit ? 'Edit Catalog Prize' : 'Add New Prize'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Define your store prize details. Quantities, daily limits, and odds are configured per campaign.
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
          <div className="mx-4 sm:mx-5 mt-3 p-3 bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form id="add-prize-form" onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* PRIZE NAME */}
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
                placeholder="e.g. ₹300 Cashback, 20% Off, Free Coffee"
                className="w-full pl-9 pr-3 py-2.5 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-medium outline-none focus:border-amber-400 text-xs"
              />
            </div>
          </div>

          {/* PRIZE IMAGE URL (OR DRAG & DROP) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              PRIZE IMAGE (URL OR DRAG & DROP)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://.../prize-banner.png"
                className="w-full pl-3 pr-10 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-mono text-[11px] outline-none focus:border-amber-400"
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
                  className="w-20 h-14 rounded-lg object-contain bg-slate-950 border border-slate-700 shadow-md p-1"
                />
                <div className="text-left text-[11px]">
                  <p className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Image Attached
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Drag another file here or click upload icon to change
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px]">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Drag & drop prize banner here, or upload from computer</span>
              </div>
            )}
          </div>

          {/* Preferred Image Size Guidance Banner */}
          <div className="flex items-start gap-2.5 p-2.5 bg-amber-400/10 border border-amber-400/25 rounded-xl text-amber-200/90">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-left text-[11px] leading-relaxed">
              <p className="font-bold text-amber-300">
                Recommended Banner Size:
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                <strong>600 × 400 px</strong> (3:2 or 16:9 banner) ensures text and brand graphics look stunning on scratch cards.
              </p>
            </div>
          </div>

          {/* DESCRIPTION / TERMS */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              DESCRIPTION / TERMS & CONDITIONS
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Valid on dine-in orders above ₹500. Cannot be combined with other offers."
              className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-white outline-none focus:border-amber-400 resize-none font-medium text-xs"
            />
          </div>

          {/* COUPON CODE & PREFIX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-teal-400" />
                PROMO / COUPON CODE
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="e.g. FLAT20, COFFEE100"
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-mono uppercase text-xs outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Fixed promo code for website/checkout</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                WIN CODE PREFIX
              </label>
              <input
                type="text"
                value={winCodePrefix}
                onChange={(e) => setWinCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="WIN"
                maxLength={6}
                className="w-full px-3 py-2 bg-[#1A2634] border border-slate-700 rounded-xl text-white font-mono uppercase text-xs outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Prefix for customer tickets (e.g. WIN-XXXX)</span>
            </div>
          </div>

          {/* Optional Attach to Active Campaign (if opened from campaign context) */}
          {currentCampaignId && !prizeToEdit && (
            <div className="p-3 bg-teal-950/40 border border-teal-800/60 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-teal-300">
                  Attach to Current Campaign Pool
                </p>
                <p className="text-[10px] text-teal-400/80">
                  Instantly add this prize to your live campaign with initial default quota (100).
                </p>
              </div>
              <input
                type="checkbox"
                checked={attachToCurrentCampaign}
                onChange={(e) => setAttachToCurrentCampaign(e.target.checked)}
                className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400 bg-slate-900 border-slate-700"
              />
            </div>
          )}

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
            form="add-prize-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : prizeToEdit ? 'Update Catalog Prize' : 'Save to Prize Catalog'}
          </button>
        </div>
      </div>
    </div>
  );
};
