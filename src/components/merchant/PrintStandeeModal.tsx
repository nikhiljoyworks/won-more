import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Sparkles, Store, CheckCircle, ShieldCheck } from 'lucide-react';
import { Shop, Campaign } from '../../types';
import { buildCampaignUrl, getNavigableCampaignUrl } from '../../lib/domain';

interface PrintStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop;
  campaign: Campaign;
}

export const PrintStandeeModal: React.FC<PrintStandeeModalProps> = ({
  isOpen,
  onClose,
  shop,
  campaign,
}) => {
  if (!isOpen) return null;

  const brandedUrl = buildCampaignUrl(shop.slug, campaign.slug);
  const navigableUrl = getNavigableCampaignUrl(shop.slug, campaign.slug);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-fadeIn my-8">
        {/* Header Controls (Hidden on Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 no-print">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Counter Standee & QR Print</h3>
            <p className="text-xs text-slate-500">A5 table tent / counter standee ready for in-store display</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Standee Preview Area */}
        <div id="standee-print-area" className="my-5 p-8 rounded-2xl bg-gradient-to-b from-[#0F4C5C] to-[#0A333E] text-white text-center shadow-lg border border-teal-light/30 relative overflow-hidden">
          {/* Decorative Sparkles & Rings */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-coral-brand/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-teal-300/10 rounded-full blur-2xl pointer-events-none" />

          {/* Shop Header */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {campaign.logo_url ? (
              <img
                src={campaign.logo_url}
                alt={shop.shop_name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/60 shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/40">
                <Store className="w-6 h-6 text-coral-brand" />
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-0.5">{shop.shop_name}</h2>
          <p className="text-xs text-teal-200/80 uppercase tracking-widest font-semibold mb-4">
            Exclusive In-Store Rewards
          </p>

          {/* Standee Main Callout */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 mb-6">
            <h1 className="text-lg font-extrabold text-white flex items-center justify-center gap-1.5 leading-snug">
              <Sparkles className="w-5 h-5 text-coral-brand shrink-0" />
              <span>SCAN, SCRATCH & WIN!</span>
            </h1>
            <p className="text-xs text-slate-200 mt-1">
              Win instant discounts, free items, and exclusive vouchers today!
            </p>
          </div>

          {/* Large Dynamic QR Code Container */}
          <div className="bg-white p-4 rounded-2xl shadow-xl inline-block mx-auto border-4 border-coral-brand/80 relative">
            <QRCodeSVG
              value={navigableUrl}
              size={180}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: "/favicon.svg",
                x: undefined,
                y: undefined,
                height: 32,
                width: 32,
                excavate: true,
              }}
            />
          </div>

          {/* Branded Link Display */}
          <div className="mt-4">
            <p className="text-[11px] text-teal-200/70 font-mono tracking-wide">
              Or visit: <span className="text-white font-bold">{brandedUrl}</span>
            </p>
          </div>

          {/* 3 Step Instruction Guide */}
          <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-3 gap-2 text-[10px] text-slate-200">
            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-coral-brand text-white font-bold flex items-center justify-center mb-1">1</span>
              <span>Scan QR with camera</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-coral-brand text-white font-bold flex items-center justify-center mb-1">2</span>
              <span>Follow & verify</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-coral-brand text-white font-bold flex items-center justify-center mb-1">3</span>
              <span>Scratch & show cashier</span>
            </div>
          </div>

          {/* Powered by Won More */}
          <div className="mt-6 text-[10px] text-teal-300/50 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Powered by Won More SaaS</span>
          </div>
        </div>

        {/* Modal Actions (Hidden on Print) */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-coral-brand hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            Print Standee (A5)
          </button>
        </div>
      </div>
    </div>
  );
};
