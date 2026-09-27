import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Sparkles, Store } from 'lucide-react';
import { Shop, Campaign } from '../../types';
import { buildCampaignUrl, getNavigableCampaignUrl } from '../../lib/domain';

type PaperSize = 'A5' | 'A4' | 'A3';

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
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');

  if (!isOpen) return null;

  const brandedUrl = buildCampaignUrl(shop.slug, campaign.slug);
  const navigableUrl = getNavigableCampaignUrl(shop.slug, campaign.slug);

  const effectiveLogo = shop?.logo_url || campaign?.logo_url;
  const bgColor = campaign?.background_color || '#0F4C5C';
  const accentColor = campaign?.button_color || '#F26419';

  const handlePrint = () => {
    window.print();
  };

  // Sizing parameters based on selected paper format
  const sizeConfig = {
    A5: {
      label: 'A5 Standee / Table Tent',
      dimensions: '148 × 210 mm',
      qrSize: 180,
      qrLogoSize: 32,
      logoClass: 'w-12 h-12',
      titleClass: 'text-xl',
      badgePadding: 'p-2.5',
      containerClass: 'max-w-xs',
    },
    A4: {
      label: 'A4 Standard Counter Display',
      dimensions: '210 × 297 mm',
      qrSize: 220,
      qrLogoSize: 40,
      logoClass: 'w-14 h-14',
      titleClass: 'text-2xl',
      badgePadding: 'p-3',
      containerClass: 'max-w-sm',
    },
    A3: {
      label: 'A3 In-Store Poster / Wall Standee',
      dimensions: '297 × 420 mm',
      qrSize: 260,
      qrLogoSize: 48,
      logoClass: 'w-16 h-16',
      titleClass: 'text-3xl',
      badgePadding: 'p-3.5',
      containerClass: 'max-w-md',
    },
  }[paperSize];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-hidden">
      {/* Dynamic Print CSS for chosen Paper Size */}
      <style>{`
        @page {
          size: ${paperSize.toLowerCase()} portrait;
          margin: 0mm;
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Header Controls (Fixed, Hidden on Print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 no-print shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Print QR Counter Standee
            </h3>
            <p className="text-xs text-slate-500">
              Customized with your campaign theme & merchant branding
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Size Selector (Fixed, Hidden on Print) */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 no-print shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Paper Size:</span>
            <span className="text-[11px] text-slate-500 font-mono">({sizeConfig.dimensions})</span>
          </div>

          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            {(['A5', 'A4', 'A3'] as PaperSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPaperSize(size)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  paperSize === size
                    ? 'bg-teal-brand text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center items-start bg-slate-100/60">
          <div
            id="standee-print-area"
            style={{
              backgroundColor: bgColor,
              background: `radial-gradient(circle at 50% 20%, ${bgColor}ee 0%, ${bgColor} 70%, #06191f 100%)`,
            }}
            className={`w-full ${sizeConfig.containerClass} rounded-2xl text-white text-center shadow-xl border border-white/20 p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between`}
          >
            {/* Ambient Glow Orbs */}
            <div
              className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-25 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top: Merchant Logo & Store Name */}
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-center">
                {effectiveLogo ? (
                  <img
                    src={effectiveLogo}
                    alt={shop.shop_name}
                    className={`${sizeConfig.logoClass} rounded-2xl object-contain bg-white p-1 border-2 border-white/80 shadow-md mx-auto`}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className={`${sizeConfig.logoClass} rounded-2xl flex items-center justify-center border-2 border-white/40 mx-auto shadow-md`}
                    style={{ backgroundColor: accentColor }}
                  >
                    <Store className="w-7 h-7 text-white" />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                  {shop.shop_name}
                </h2>
                <p className="text-[11px] text-white/80 uppercase tracking-widest font-bold mt-0.5">
                  Exclusive In-Store Rewards
                </p>
              </div>

              {/* Campaign Callout Banner */}
              <div
                className={`rounded-xl ${sizeConfig.badgePadding} border border-white/25 shadow-sm mt-3`}
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
              >
                <h1 className={`${sizeConfig.titleClass} font-black text-white flex items-center justify-center gap-1.5 uppercase leading-snug`}>
                  <Sparkles className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
                  <span>{campaign.title || 'SCAN, SCRATCH & WIN!'}</span>
                </h1>
                <p className="text-xs text-white/90 mt-0.5 font-medium">
                  Win instant discounts, gifts & exclusive vouchers today!
                </p>
              </div>
            </div>

            {/* Middle: Prominent Dynamic QR Code */}
            <div className="relative z-10 my-4 sm:my-6">
              <div
                className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xl inline-block mx-auto border-4 relative"
                style={{ borderColor: accentColor }}
              >
                <QRCodeSVG
                  value={navigableUrl}
                  size={sizeConfig.qrSize}
                  level="H"
                  includeMargin={false}
                  imageSettings={
                    effectiveLogo
                      ? {
                          src: effectiveLogo,
                          x: undefined,
                          y: undefined,
                          height: sizeConfig.qrLogoSize,
                          width: sizeConfig.qrLogoSize,
                          excavate: true,
                        }
                      : undefined
                  }
                />
              </div>

              {/* Branded Link Display */}
              <div className="mt-3">
                <p className="text-[11px] text-white/80 font-mono tracking-wide">
                  Or visit: <span className="text-white font-bold underline underline-offset-2">{brandedUrl}</span>
                </p>
              </div>
            </div>

            {/* Bottom: 3-Step Simple Play Instructions */}
            <div className="relative z-10 pt-4 border-t border-white/20">
              <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-[11px] text-white/90 font-medium">
                <div className="flex flex-col items-center">
                  <span
                    className="w-5 h-5 rounded-full text-white font-bold flex items-center justify-center mb-1 text-[10px] shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    1
                  </span>
                  <span>Scan QR code</span>
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className="w-5 h-5 rounded-full text-white font-bold flex items-center justify-center mb-1 text-[10px] shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    2
                  </span>
                  <span>Enter details</span>
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className="w-5 h-5 rounded-full text-white font-bold flex items-center justify-center mb-1 text-[10px] shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    3
                  </span>
                  <span>Scratch & win</span>
                </div>
              </div>

              {/* Powered by Won More */}
              <div className="mt-4 text-[10px] text-white/60 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-white/70" />
                <span>Powered by Won More SaaS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Fixed, Hidden on Print) */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-white no-print shrink-0">
          <div className="text-xs text-slate-500">
            Selected: <strong className="text-slate-800">{sizeConfig.label}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Standee ({paperSize})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
