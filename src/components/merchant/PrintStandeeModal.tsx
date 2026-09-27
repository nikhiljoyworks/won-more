import React, { useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download, Sparkles, Store, Loader2 } from 'lucide-react';
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

  if (!isOpen) return null;

  const navigableUrl = getNavigableCampaignUrl(shop.slug, campaign.slug);
  const effectiveLogo = shop?.logo_url || campaign?.logo_url;
  const bgColor = campaign?.background_color || '#0F4C5C';
  const accentColor = campaign?.button_color || '#F26419';

  // Sizing parameters based on selected paper format
  const sizeConfig = {
    A5: {
      label: 'A5 Standee / Table Tent',
      dimensions: '148 × 210 mm',
      canvasWidth: 1200,
      canvasHeight: 1700,
      scale: 1,
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
      canvasWidth: 1600,
      canvasHeight: 2260,
      scale: 1.33,
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
      canvasWidth: 2400,
      canvasHeight: 3400,
      scale: 2,
      qrSize: 260,
      qrLogoSize: 48,
      logoClass: 'w-16 h-16',
      titleClass: 'text-3xl',
      badgePadding: 'p-3.5',
      containerClass: 'max-w-md',
    },
  }[paperSize];

  // Helper: Draw rounded rectangle path
  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Helper: Safely load image ensuring it won't taint the canvas
  const loadLogoSafely = async (url?: string | null): Promise<HTMLImageElement | null> => {
    if (!url) return null;

    // Try 1: Load via proxy endpoint with CORS
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = proxyUrl;
      });

      // Test whether canvas can be exported without tainting
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 2;
      testCanvas.height = 2;
      const testCtx = testCanvas.getContext('2d');
      if (testCtx) {
        testCtx.drawImage(img, 0, 0, 2, 2);
        testCanvas.toDataURL(); // Throws SecurityError if tainted
        return img;
      }
    } catch {
      // Proxy failed or not running in dev, fallback to direct with CORS
    }

    // Try 2: Load direct URL with anonymous CORS
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const corsUrl = url.includes('?') ? `${url}&cors=1` : `${url}?cors=1`;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = corsUrl;
      });

      const testCanvas = document.createElement('canvas');
      testCanvas.width = 2;
      testCanvas.height = 2;
      const testCtx = testCanvas.getContext('2d');
      if (testCtx) {
        testCtx.drawImage(img, 0, 0, 2, 2);
        testCanvas.toDataURL();
        return img;
      }
    } catch {
      // CORS rejected, fallback safely to initial badge
    }

    return null;
  };

  // Generate 300 DPI High-Resolution Standee on Canvas for PNG download
  const generateStandeeCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const { canvasWidth: width, canvasHeight: height, scale } = sizeConfig;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Safely load logo (guaranteed never to taint the canvas)
    const logoImg = await loadLogoSafely(effectiveLogo);

    // 1. Clean White Sheet Base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Card Boundary
    const cardMargin = 40 * scale;
    const cardX = cardMargin;
    const cardY = cardMargin;
    const cardW = width - 2 * cardMargin;
    const cardH = height - 2 * cardMargin;
    const cardRadius = 36 * scale;

    // 3. Card Background Radial Gradient
    ctx.save();
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.clip();

    const bgGradient = ctx.createRadialGradient(
      width / 2,
      cardY + cardH * 0.2,
      0,
      width / 2,
      cardY + cardH * 0.5,
      cardH * 0.8
    );
    bgGradient.addColorStop(0, bgColor);
    bgGradient.addColorStop(0.65, bgColor);
    bgGradient.addColorStop(1, '#06191f');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Ambient Glow Orbs
    const glowTop = ctx.createRadialGradient(
      cardX + cardW - 40 * scale,
      cardY + 40 * scale,
      0,
      cardX + cardW - 40 * scale,
      cardY + 40 * scale,
      cardW * 0.35
    );
    glowTop.addColorStop(0, accentColor + '44');
    glowTop.addColorStop(1, 'transparent');
    ctx.fillStyle = glowTop;
    ctx.beginPath();
    ctx.arc(cardX + cardW - 40 * scale, cardY + 40 * scale, cardW * 0.35, 0, Math.PI * 2);
    ctx.fill();

    const glowBottom = ctx.createRadialGradient(
      cardX + 40 * scale,
      cardY + cardH - 40 * scale,
      0,
      cardX + 40 * scale,
      cardY + cardH - 40 * scale,
      cardW * 0.35
    );
    glowBottom.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    glowBottom.addColorStop(1, 'transparent');
    ctx.fillStyle = glowBottom;
    ctx.beginPath();
    ctx.arc(cardX + 40 * scale, cardY + cardH - 40 * scale, cardW * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Card Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2.5 * scale;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

    // 4. Logo Area
    const logoBoxSize = 110 * scale;
    const logoX = width / 2 - logoBoxSize / 2;
    const logoY = cardY + 48 * scale;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, logoX, logoY, logoBoxSize, logoBoxSize, 22 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();

    if (logoImg) {
      const padding = 10 * scale;
      ctx.drawImage(
        logoImg,
        logoX + padding,
        logoY + padding,
        logoBoxSize - 2 * padding,
        logoBoxSize - 2 * padding
      );
    } else {
      // Store Icon or Initial fallback
      ctx.fillStyle = accentColor;
      drawRoundRect(ctx, logoX, logoY, logoBoxSize, logoBoxSize, 22 * scale);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${48 * scale}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shop.shop_name.charAt(0).toUpperCase(), width / 2, logoY + logoBoxSize / 2);
    }
    ctx.restore();

    // 5. Store Name & Subtitle
    let textY = logoY + logoBoxSize + 42 * scale;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${36 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(shop.shop_name, width / 2, textY);

    textY += 30 * scale;
    ctx.font = `700 ${15 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('EXCLUSIVE IN-STORE REWARDS', width / 2, textY);

    // 6. Campaign Callout Banner
    textY += 36 * scale;
    const bannerW = cardW - 70 * scale;
    const bannerH = 92 * scale;
    const bannerX = width / 2 - bannerW / 2;
    const bannerY = textY;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 18 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Campaign Title
    ctx.font = `900 ${28 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText((campaign.title || 'SCAN, SCRATCH & WIN!').toUpperCase(), width / 2, bannerY + 36 * scale);

    // Subtitle
    ctx.font = `500 ${16 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('Win instant discounts, gifts & exclusive vouchers today!', width / 2, bannerY + 68 * scale);

    // 7. Dynamic QR Code Box (Pure Vector QR, 0 CORS Risk)
    const qrCanvas = document.getElementById('standee-pure-qr-canvas') as HTMLCanvasElement;
    const qrBoxSize = 460 * scale;
    const qrBoxX = width / 2 - qrBoxSize / 2;
    const qrBoxY = bannerY + bannerH + 48 * scale;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28 * scale);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 10 * scale;
    drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28 * scale);
    ctx.stroke();

    if (qrCanvas) {
      const qrPadding = 24 * scale;
      ctx.drawImage(
        qrCanvas,
        qrBoxX + qrPadding,
        qrBoxY + qrPadding,
        qrBoxSize - 2 * qrPadding,
        qrBoxSize - 2 * qrPadding
      );
    }
    ctx.restore();

    // 8. 3-Step Play Instructions
    const dividerY = cardY + cardH - 165 * scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cardX + 40 * scale, dividerY);
    ctx.lineTo(cardX + cardW - 40 * scale, dividerY);
    ctx.stroke();

    const stepCols = [
      { num: '1', text: 'Scan QR code' },
      { num: '2', text: 'Enter details' },
      { num: '3', text: 'Scratch & win' },
    ];

    const colWidth = (cardW - 80 * scale) / 3;
    stepCols.forEach((step, idx) => {
      const colX = cardX + 40 * scale + idx * colWidth + colWidth / 2;
      const numY = dividerY + 38 * scale;

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(colX, numY, 15 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${16 * scale}px system-ui, sans-serif`;
      ctx.fillText(step.num, colX, numY + 1 * scale);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = `600 ${15 * scale}px system-ui, sans-serif`;
      ctx.fillText(step.text, colX, numY + 32 * scale);
    });

    // 9. Footer Brand Note
    const footerY = cardY + cardH - 32 * scale;
    ctx.font = `500 ${14 * scale}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('✨ Powered by Won More SaaS', width / 2, footerY);

    ctx.restore();
    return canvas;
  };

  // Download Standee as PNG
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const canvas = await generateStandeeCanvas();
      if (!canvas) {
        toast.error('Could not generate standee graphic.');
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
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

  // Print Standee using Isolated Iframe (100% full-bleed, unclipped, native vector clarity)
  const handlePrint = () => {
    setIsExporting(true);
    try {
      const standeeEl = document.getElementById('standee-print-area');
      if (!standeeEl) {
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

      // Copy all stylesheets from parent document (Tailwind CSS, custom fonts)
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
                padding: 10mm;
                box-sizing: border-box;
              }
              #standee-print-area {
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
                padding: 32px 28px !important;
              }
            </style>
          </head>
          <body>
            <div class="standee-print-wrapper">
              ${standeeEl.outerHTML}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-hidden">
      {/* Pure Vector QR Canvas for high-res PNG export (0 CORS dependencies) */}
      <div className="hidden">
        <QRCodeCanvas
          id="standee-pure-qr-canvas"
          value={navigableUrl}
          size={500}
          level="H"
          includeMargin={false}
        />
      </div>

      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Header Controls (Fixed, Hidden on Print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 no-print shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Print & Download QR Counter Standee
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
            <div className="relative z-10 my-5 sm:my-7">
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
        <div className="flex flex-wrap items-center justify-between p-4 border-t border-slate-100 bg-white no-print shrink-0 gap-3">
          <div className="text-xs text-slate-500">
            Selected: <strong className="text-slate-800">{sizeConfig.label}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Download Standee Button */}
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition disabled:opacity-50 border border-slate-300 shadow-2xs"
              title="Download High-Res PNG"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download PNG</span>
            </button>

            {/* Print Standee Button */}
            <button
              onClick={handlePrint}
              disabled={isExporting}
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>Print Standee ({paperSize})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
