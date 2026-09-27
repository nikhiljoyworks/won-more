import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { X, Printer, Download, Smartphone, Gift, Ticket, ChevronRight, Loader2 } from 'lucide-react';
import { Shop, Campaign } from '../../types';
import { getNavigableCampaignUrl } from '../../lib/domain';
import { toast } from '../../context/ToastContext';

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
  const [isExporting, setIsExporting] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const navigableUrl = getNavigableCampaignUrl(shop.slug, campaign.slug);
  const effectiveLogo = shop?.logo_url || campaign?.logo_url;
  // Default to rich dark emerald green from the mockup design
  const bgColor = campaign?.background_color || '#085834';
  const accentColor = campaign?.button_color || '#16A34A';

  // Pre-load logo as base64 data URL so both preview, print, and PNG export render it seamlessly with 0 CORS issues
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const url = effectiveLogo;
    if (!url) {
      setLogoDataUrl(null);
      return;
    }

    if (url.startsWith('data:')) {
      setLogoDataUrl(url);
      return;
    }

    const convertToBase64 = async () => {
      // 1. Try fetching via worker proxy endpoint
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted && typeof reader.result === 'string') {
              setLogoDataUrl(reader.result);
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      } catch {
        // Fallback
      }

      // 2. Direct fetch fallback
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted && typeof reader.result === 'string') {
              setLogoDataUrl(reader.result);
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      } catch {
        // Fallback
      }

      if (isMounted) {
        setLogoDataUrl(url);
      }
    };

    convertToBase64();
    return () => {
      isMounted = false;
    };
  }, [isOpen, effectiveLogo]);

  if (!isOpen) return null;

  // Sizing parameters based on selected paper format
  const sizeConfig = {
    A5: {
      label: 'A5 Table Tent',
      dimensions: '148 × 210 mm',
      qrSize: 160,
      containerClass: 'max-w-[320px] sm:max-w-[340px]',
    },
    A4: {
      label: 'A4 Counter Standee',
      dimensions: '210 × 297 mm',
      qrSize: 180,
      containerClass: 'max-w-[340px] sm:max-w-[380px]',
    },
    A3: {
      label: 'A3 Poster Standee',
      dimensions: '297 × 420 mm',
      qrSize: 200,
      containerClass: 'max-w-[360px] sm:max-w-[420px]',
    },
  }[paperSize];

  // Download Standee as PNG: Uses standard 640px HD export canvas for 100% resolution independence
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const exportEl = document.getElementById('standee-export-canvas') || document.getElementById('standee-print-area');
      if (!exportEl) {
        toast.error('Could not locate standee element.');
        return;
      }

      // Wait for fonts to be ready
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Capture standard canvas at 2.5x high resolution (generates crisp 1600x2262px 300 DPI image)
      const dataUrl = await toPng(exportEl, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: false,
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Standee-${shop.slug}-${campaign.slug}-${paperSize}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Standee downloaded as ${paperSize} High-Res PNG!`);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download standee PNG.');
    } finally {
      setIsExporting(false);
    }
  };

  // Print Standee using Isolated Iframe (100% full-bleed, unclipped, vector clarity)
  const handlePrint = () => {
    setIsExporting(true);
    try {
      const exportEl = document.getElementById('standee-export-canvas') || document.getElementById('standee-print-area');
      if (!exportEl) {
        toast.error('Could not locate standee element.');
        return;
      }

      // Clean up any existing print iframe
      const oldIframe = document.getElementById('standee-print-iframe');
      if (oldIframe) {
        document.body.removeChild(oldIframe);
      }

      const printIframe = document.createElement('iframe');
      printIframe.id = 'standee-print-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.left = '-9999px';
      printIframe.style.top = '-9999px';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow?.document;
      if (!doc) throw new Error('Cannot access print document');

      // Copy all stylesheets from parent document (Tailwind CSS, fonts)
      const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join('\n');

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Standee - ${shop.shop_name}</title>
            ${styleTags}
            <style>
              @page {
                size: ${paperSize.toLowerCase()} portrait;
                margin: 0mm;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                width: 100vw !important;
                height: 100vh !important;
                max-height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                overflow: hidden !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .standee-print-wrapper {
                width: 100vw;
                height: 100vh;
                max-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6mm;
                box-sizing: border-box;
              }
              #standee-export-canvas, #standee-print-area {
                width: 100% !important;
                max-width: 100% !important;
                height: 100% !important;
                max-height: 100% !important;
                border-radius: 28px !important;
                margin: 0 !important;
                box-shadow: none !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
              }
            </style>
          </head>
          <body>
            <div class="standee-print-wrapper">
              ${exportEl.outerHTML}
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
        setIsExporting(false);
      }, 350);
    } catch (err) {
      console.error('Print error:', err);
      toast.error('Failed to trigger printing.');
      setIsExporting(false);
    }
  };

  const activeLogo = logoDataUrl || effectiveLogo;

  const renderStandeeCard = (id: string, isExport: boolean) => {
    const qrSize = isExport ? 260 : Math.min(sizeConfig.qrSize, 175);
    const logoSizeClass = isExport ? 'w-20 h-20' : 'w-13 h-13 sm:w-15 sm:h-15';
    const logoMaxStyle = isExport
      ? { maxWidth: '80px', maxHeight: '80px' }
      : { maxWidth: '58px', maxHeight: '58px' };

    return (
      <div
        id={id}
        className={`bg-white text-center flex flex-col justify-between overflow-hidden ${
          isExport
            ? 'w-[640px] min-h-[905px] rounded-[32px] shadow-none'
            : `w-full ${sizeConfig.containerClass} rounded-3xl shadow-xl border border-slate-200/80`
        }`}
        style={isExport ? { width: '640px', minHeight: '905px' } : { minHeight: '510px' }}
      >
        {/* TOP BRAND BANNER */}
        <div
          style={{ backgroundColor: bgColor }}
          className={`relative text-white ${isExport ? 'pt-7 pb-3 px-6' : 'pt-4 pb-2 px-3'} text-center`}
        >
          {/* Merchant Logo Badge */}
          <div className="flex items-center justify-center">
            {activeLogo ? (
              <img
                src={activeLogo}
                alt={shop.shop_name}
                className="rounded-2xl object-contain bg-white p-1.5 border-2 border-white/90 shadow-md mx-auto shrink-0"
                style={{ width: isExport ? '80px' : '54px', height: isExport ? '80px' : '54px', ...logoMaxStyle }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="rounded-2xl flex items-center justify-center border-2 border-white/80 mx-auto shadow-md shrink-0"
                style={{
                  width: isExport ? '80px' : '54px',
                  height: isExport ? '80px' : '54px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  ...logoMaxStyle,
                }}
              >
                <span className={`${isExport ? 'text-3xl' : 'text-xl'} font-black text-white`}>
                  {shop.shop_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Shop Name */}
          <h2
            className={`${
              isExport ? 'text-3xl mt-3' : 'text-base sm:text-lg mt-1.5'
            } font-black tracking-tight text-white leading-tight`}
          >
            {shop.shop_name}
          </h2>

          {/* Tagline: EXCLUSIVE IN-STORE REWARDS */}
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="h-[1px] w-6 bg-white/40" />
            <span
              className={`${
                isExport ? 'text-xs tracking-widest' : 'text-[9px] sm:text-[10px] tracking-wider'
              } font-bold text-white/90 uppercase`}
            >
              EXCLUSIVE IN-STORE REWARDS
            </span>
            <div className="h-[1px] w-6 bg-white/40" />
          </div>

          {/* Convex Wave Transition to White Section */}
          <div className="w-full relative mt-2" style={{ height: isExport ? '24px' : '16px', marginBottom: '-1px' }}>
            <svg className="w-full h-full block" viewBox="0 0 500 24" preserveAspectRatio="none">
              <path d="M 0,0 L 0,22 Q 250,2 500,22 L 500,0 Z" fill={bgColor} />
            </svg>
          </div>
        </div>

        {/* MIDDLE WHITE CARD: "Scan & Win" + Sunburst Rays + QR Code */}
        <div className={`flex-1 flex flex-col items-center justify-center bg-white ${isExport ? 'px-8 py-4' : 'px-3 py-2'}`}>
          <div className="text-center">
            <div
              className={`${isExport ? 'text-4xl' : 'text-xl sm:text-2xl'} font-black tracking-tight leading-none`}
              style={{ color: bgColor }}
            >
              Scan &
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              {/* Left Golden Sunburst Rays */}
              <svg className={`${isExport ? 'w-8 h-10' : 'w-5 h-7'} shrink-0`} viewBox="0 0 28 40" fill="none">
                <line x1="24" y1="10" x2="6" y2="4" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="24" y1="20" x2="4" y2="20" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
                <line x1="24" y1="30" x2="6" y2="36" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
              </svg>

              <span
                className={`${isExport ? 'text-5xl' : 'text-2xl sm:text-3xl'} font-black tracking-tight`}
                style={{ color: '#16A34A' }}
              >
                Win
              </span>

              {/* Right Golden Sunburst Rays */}
              <svg className={`${isExport ? 'w-8 h-10' : 'w-5 h-7'} shrink-0`} viewBox="0 0 28 40" fill="none">
                <line x1="4" y1="10" x2="22" y2="4" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="4" y1="20" x2="24" y2="20" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
                <line x1="4" y1="30" x2="22" y2="36" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>

            <p
              className={`${
                isExport ? 'text-sm mt-1.5' : 'text-[10px] sm:text-[11px] mt-0.5'
              } font-bold text-slate-700 tracking-wide`}
            >
              Instant Discounts &nbsp;|&nbsp; Exclusive Vouchers &nbsp;|&nbsp; Special Offers
            </p>
          </div>

          {/* Prominent Large QR Code in Rounded Box */}
          <div className={`${isExport ? 'my-4' : 'my-2'}`}>
            <div
              className={`bg-white ${
                isExport ? 'p-4 rounded-[28px] border-[6px]' : 'p-2.5 rounded-2xl border-[4px]'
              } shadow-lg inline-block mx-auto`}
              style={{ borderColor: bgColor }}
            >
              <QRCodeSVG
                value={navigableUrl}
                size={qrSize}
                level="H"
                includeMargin={false}
                imageSettings={
                  activeLogo
                    ? {
                        src: activeLogo,
                        x: undefined,
                        y: undefined,
                        height: isExport ? 44 : 32,
                        width: isExport ? 44 : 32,
                        excavate: true,
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        {/* BOTTOM GREEN BANNER WITH YELLOW SWOOSH RIBBON & 3 ACTION STEPS */}
        <div className="relative text-center" style={{ backgroundColor: bgColor }}>
          {/* Yellow Swoosh Accent Ribbon & Green Wave Divider */}
          <div
            className="w-full relative"
            style={{
              height: isExport ? '36px' : '22px',
              marginTop: isExport ? '-35px' : '-21px',
              marginBottom: '-1px',
            }}
          >
            <svg className="w-full h-full block" viewBox="0 0 500 40" preserveAspectRatio="none">
              <path
                d="M 0,34 Q 180,44 340,24 Q 420,14 500,2 L 500,10 Q 420,20 340,30 Q 180,50 0,40 Z"
                fill="#FBBF24"
              />
              <path d="M 0,38 Q 180,47 340,28 Q 420,18 500,7 L 500,40 L 0,40 Z" fill={bgColor} />
            </svg>
          </div>

          <div className={`${isExport ? 'px-8 pb-6 pt-2' : 'px-3 pb-3 pt-1'} relative z-10`}>
            {/* 3 Step Action Badges: [1] Phone > [2] Gift > [3] Ticket % */}
            <div
              className={`flex items-center justify-center ${
                isExport ? 'gap-4 max-w-md' : 'gap-1.5 max-w-xs'
              } mx-auto`}
            >
              {/* Step 1 */}
              <div className="flex-1 flex flex-col items-center">
                <div
                  className={`${
                    isExport ? 'w-14 h-14' : 'w-9 h-9 sm:w-10 sm:h-10'
                  } bg-white rounded-full flex items-center justify-center relative shadow-md`}
                >
                  <div
                    className={`absolute -top-1 left-1/2 -translate-x-1/2 ${
                      isExport ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[9px]'
                    } rounded-full flex items-center justify-center text-white font-black border border-white`}
                    style={{ backgroundColor: bgColor }}
                  >
                    1
                  </div>
                  <Smartphone
                    className={`${isExport ? 'w-7 h-7' : 'w-4 h-4 sm:w-5 sm:h-5'}`}
                    style={{ color: bgColor }}
                  />
                </div>
                <span
                  className={`${
                    isExport ? 'text-xs mt-2' : 'text-[9px] sm:text-[10px] mt-1'
                  } font-bold text-white tracking-wide`}
                >
                  Scan QR code
                </span>
              </div>

              {/* Arrow 1 */}
              <ChevronRight
                className={`${isExport ? 'w-5 h-5 -mt-4' : 'w-3.5 h-3.5 -mt-3'} text-white/70 shrink-0`}
              />

              {/* Step 2 */}
              <div className="flex-1 flex flex-col items-center">
                <div
                  className={`${
                    isExport ? 'w-14 h-14' : 'w-9 h-9 sm:w-10 sm:h-10'
                  } bg-white rounded-full flex items-center justify-center relative shadow-md`}
                >
                  <div
                    className={`absolute -top-1 left-1/2 -translate-x-1/2 ${
                      isExport ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[9px]'
                    } rounded-full flex items-center justify-center text-white font-black border border-white`}
                    style={{ backgroundColor: bgColor }}
                  >
                    2
                  </div>
                  <Gift
                    className={`${isExport ? 'w-7 h-7' : 'w-4 h-4 sm:w-5 sm:h-5'}`}
                    style={{ color: bgColor }}
                  />
                </div>
                <span
                  className={`${
                    isExport ? 'text-xs mt-2' : 'text-[9px] sm:text-[10px] mt-1'
                  } font-bold text-white tracking-wide`}
                >
                  Enter details
                </span>
              </div>

              {/* Arrow 2 */}
              <ChevronRight
                className={`${isExport ? 'w-5 h-5 -mt-4' : 'w-3.5 h-3.5 -mt-3'} text-white/70 shrink-0`}
              />

              {/* Step 3 */}
              <div className="flex-1 flex flex-col items-center">
                <div
                  className={`${
                    isExport ? 'w-14 h-14' : 'w-9 h-9 sm:w-10 sm:h-10'
                  } bg-white rounded-full flex items-center justify-center relative shadow-md`}
                >
                  <div
                    className={`absolute -top-1 left-1/2 -translate-x-1/2 ${
                      isExport ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[9px]'
                    } rounded-full flex items-center justify-center text-white font-black border border-white`}
                    style={{ backgroundColor: bgColor }}
                  >
                    3
                  </div>
                  <div className="relative flex items-center justify-center">
                    <Ticket
                      className={`${isExport ? 'w-7 h-7' : 'w-4 h-4 sm:w-5 sm:h-5'}`}
                      style={{ color: bgColor }}
                    />
                    <span className="absolute text-[8px] font-black" style={{ color: bgColor }}>
                      %
                    </span>
                  </div>
                </div>
                <span
                  className={`${
                    isExport ? 'text-xs mt-2' : 'text-[9px] sm:text-[10px] mt-1'
                  } font-bold text-white tracking-wide`}
                >
                  Scratch & win
                </span>
              </div>
            </div>

            {/* Footer Note */}
            <div className={`${isExport ? 'mt-4' : 'mt-2.5'} flex items-center justify-center gap-2`}>
              <div className="h-[1px] w-6 bg-white/40" />
              <span
                className={`${
                  isExport ? 'text-xs tracking-widest' : 'text-[8px] sm:text-[9px] tracking-wider'
                } uppercase font-bold text-white/90`}
              >
                THANK YOU FOR SHOPPING WITH US
              </span>
              <div className="h-[1px] w-6 bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-hidden">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Header Controls (Fixed, Hidden on Print) */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-100 no-print shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Print & Download QR Counter Standee
            </h3>
            <p className="text-[11px] text-slate-500">
              High-definition standee with your store branding
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
        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 no-print shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Format:</span>
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

        {/* Scrollable Preview Area (Centered & Perfectly Fit) */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 flex justify-center items-start bg-slate-100/70">
          {renderStandeeCard('standee-print-area', false)}
        </div>

        {/* Dedicated Hidden Off-Screen Standard 640px Export Canvas for Razor-Sharp Unclipped Exports */}
        <div style={{ position: 'fixed', left: '-9999px', top: '0', pointerEvents: 'none', opacity: 0 }}>
          {renderStandeeCard('standee-export-canvas', true)}
        </div>

        {/* Modal Footer Controls (Fixed, Hidden on Print, 100% Mobile Responsive) */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white no-print shrink-0 space-y-2">
          <div className="hidden sm:flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              Selected: <strong className="text-slate-900">{sizeConfig.label}</strong>
            </span>
            <span className="text-[11px] font-mono text-slate-400">({sizeConfig.dimensions})</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="py-2.5 px-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition disabled:opacity-50 text-center"
            >
              Cancel
            </button>

            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition disabled:opacity-50 border border-slate-300 shadow-2xs text-center"
              title="Download High-Res PNG"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="truncate">Download PNG</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={isExporting}
              style={{ backgroundColor: accentColor }}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition disabled:opacity-50 text-center"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span className="truncate">Print ({paperSize})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
