import React, { useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
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

  if (!isOpen) return null;

  const navigableUrl = getNavigableCampaignUrl(shop.slug, campaign.slug);
  const effectiveLogo = shop?.logo_url || campaign?.logo_url;
  // Default to rich dark emerald green from the mockup design
  const bgColor = campaign?.background_color || '#085834';
  const accentColor = campaign?.button_color || '#16A34A';

  // Sizing parameters based on selected paper format
  const sizeConfig = {
    A5: {
      label: 'A5 Standee / Table Tent',
      dimensions: '148 × 210 mm',
      canvasWidth: 1200,
      canvasHeight: 1700,
      qrSize: 180,
      containerClass: 'max-w-[340px]',
    },
    A4: {
      label: 'A4 Standard Counter Display',
      dimensions: '210 × 297 mm',
      canvasWidth: 1600,
      canvasHeight: 2260,
      qrSize: 220,
      containerClass: 'max-w-[400px]',
    },
    A3: {
      label: 'A3 In-Store Poster / Wall Standee',
      dimensions: '297 × 420 mm',
      canvasWidth: 2400,
      canvasHeight: 3400,
      qrSize: 280,
      containerClass: 'max-w-[480px]',
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

  // Helper: Draw vector phone icon on canvas
  const drawPhoneIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    const w = size * 0.52;
    const h = size * 0.82;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = size * 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.08;
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // Screen with mini QR representation
    ctx.fillStyle = color;
    const screenPad = size * 0.11;
    drawRoundRect(ctx, x + screenPad, y + screenPad, w - 2 * screenPad, h - 2.8 * screenPad, 2);
    ctx.fill();

    // Home button dot
    ctx.beginPath();
    ctx.arc(cx, y + h - screenPad * 0.8, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  };

  // Helper: Draw vector gift box icon on canvas
  const drawGiftIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size * 0.08;
    const bw = size * 0.68;
    const bh = size * 0.46;
    const bx = cx - bw / 2;
    const by = cy - bh / 2 + size * 0.08;

    // Box body outline
    drawRoundRect(ctx, bx, by, bw, bh, 3);
    ctx.stroke();

    // Lid outline and fill
    const lw = bw * 1.1;
    const lh = size * 0.15;
    drawRoundRect(ctx, cx - lw / 2, by - lh, lw, lh, 3);
    ctx.fill();

    // Vertical ribbon band
    const rw = size * 0.13;
    ctx.fillRect(cx - rw / 2, by - lh, rw, bh + lh);

    // Bow loops
    ctx.lineWidth = size * 0.07;
    ctx.beginPath();
    ctx.arc(cx - size * 0.12, by - lh - size * 0.06, size * 0.09, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.12, by - lh - size * 0.06, size * 0.09, 0, Math.PI * 2);
    ctx.stroke();
  };

  // Helper: Draw vector ticket icon on canvas
  const drawTicketIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.08;
    const tw = size * 0.72;
    const th = size * 0.48;
    const tx = cx - tw / 2;
    const ty = cy - th / 2;
    drawRoundRect(ctx, tx, ty, tw, th, 4);
    ctx.stroke();

    // Draw % in center
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(size * 0.36)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('%', cx, cy + 1);
  };

  // Helper: Draw golden ray pill
  const drawRayPill = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    len: number,
    thickness: number,
    angleRad: number,
    color: string
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleRad);
    ctx.fillStyle = color;
    ctx.beginPath();
    drawRoundRect(ctx, 0, -thickness / 2, len, thickness, thickness / 2);
    ctx.fill();
    ctx.restore();
  };

  // Generate 300 DPI High-Resolution Standee on Canvas for PNG download
  // Exactly matching the modern layout and aesthetics of media_1790491086131.jpg
  const generateStandeeCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const { canvasWidth: width, canvasHeight: height } = sizeConfig;
    const s = width / 1200; // Scaling factor relative to 1200px base

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

    // 2. Card Boundary Clipping
    const cardMargin = 28 * s;
    const cardX = cardMargin;
    const cardY = cardMargin;
    const cardW = width - 2 * cardMargin;
    const cardH = height - 2 * cardMargin;
    const cardRadius = 38 * s;

    ctx.save();
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.clip();

    // Base card fill: white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // 3. TOP BRAND HEADER (Curved Bottom Arch)
    const topH = 340 * s;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(cardX, cardY);
    ctx.lineTo(cardX + cardW, cardY);
    ctx.lineTo(cardX + cardW, cardY + topH);
    // Convex arch dipping upward in the center
    ctx.quadraticCurveTo(width / 2, cardY + topH - 42 * s, cardX, cardY + topH);
    ctx.closePath();
    ctx.fill();

    // Merchant Logo Badge
    const logoBoxSize = 96 * s;
    const logoX = width / 2 - logoBoxSize / 2;
    const logoY = cardY + 44 * s;

    ctx.save();
    ctx.fillStyle = logoImg ? '#ffffff' : 'rgba(0, 0, 0, 0.22)';
    drawRoundRect(ctx, logoX, logoY, logoBoxSize, logoBoxSize, 22 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    if (logoImg) {
      const padding = 8 * s;
      ctx.drawImage(
        logoImg,
        logoX + padding,
        logoY + padding,
        logoBoxSize - 2 * padding,
        logoBoxSize - 2 * padding
      );
    } else {
      // White bold initial
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${46 * s}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shop.shop_name.charAt(0).toUpperCase(), width / 2, logoY + logoBoxSize / 2);
    }
    ctx.restore();

    // Store Name
    const storeNameY = logoY + logoBoxSize + 36 * s;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${36 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(shop.shop_name, width / 2, storeNameY);

    // Tagline: ── EXCLUSIVE IN-STORE REWARDS ──
    const taglineY = storeNameY + 34 * s;
    ctx.font = `700 ${14 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('──   EXCLUSIVE IN-STORE REWARDS   ──', width / 2, taglineY);

    // 4. MIDDLE SECTION: "Scan & Win" + Sunburst Rays
    const scanWinY = cardY + topH + 68 * s;
    ctx.fillStyle = bgColor;
    ctx.font = `900 ${52 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('Scan &', width / 2, scanWinY);

    const winTextY = scanWinY + 68 * s;
    ctx.fillStyle = '#16A34A';
    ctx.font = `900 ${76 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('Win', width / 2, winTextY);

    // Left & Right Golden Sunburst Rays
    const winWidth = ctx.measureText('Win').width;
    const rayDist = winWidth / 2 + 32 * s;
    const rayLen = 28 * s;
    const rayThick = 5 * s;
    const goldenColor = '#FBBF24';

    // Left Rays
    drawRayPill(ctx, width / 2 - rayDist, winTextY - 14 * s, -rayLen, rayThick, -0.42, goldenColor);
    drawRayPill(ctx, width / 2 - rayDist - 4 * s, winTextY, -rayLen * 1.08, rayThick, 0, goldenColor);
    drawRayPill(ctx, width / 2 - rayDist, winTextY + 14 * s, -rayLen, rayThick, 0.42, goldenColor);

    // Right Rays
    drawRayPill(ctx, width / 2 + rayDist, winTextY - 14 * s, rayLen, rayThick, -0.42, goldenColor);
    drawRayPill(ctx, width / 2 + rayDist + 4 * s, winTextY, rayLen * 1.08, rayThick, 0, goldenColor);
    drawRayPill(ctx, width / 2 + rayDist, winTextY + 14 * s, rayLen, rayThick, 0.42, goldenColor);

    // Subtitle: Instant Discounts | Exclusive Vouchers | Special Offers
    const subTitleY = winTextY + 58 * s;
    ctx.fillStyle = '#334155';
    ctx.font = `700 ${16 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('Instant Discounts   |   Exclusive Vouchers   |   Special Offers', width / 2, subTitleY);

    // 5. LARGE QR CODE CONTAINER (Thick Rounded Green Border)
    const qrCanvas = document.getElementById('standee-pure-qr-canvas') as HTMLCanvasElement;
    const qrBoxSize = 460 * s;
    const qrBoxX = width / 2 - qrBoxSize / 2;
    const qrBoxY = subTitleY + 36 * s;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32 * s);
    ctx.fill();

    // Thick border in brand green
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = 10 * s;
    drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32 * s);
    ctx.stroke();

    if (qrCanvas) {
      const qrPadding = 26 * s;
      ctx.drawImage(
        qrCanvas,
        qrBoxX + qrPadding,
        qrBoxY + qrPadding,
        qrBoxSize - 2 * qrPadding,
        qrBoxSize - 2 * qrPadding
      );
    }
    ctx.restore();

    // 6. BOTTOM BANNER WITH DYNAMIC YELLOW SWOOSH RIBBON & 3 STEPS
    const botY = cardY + cardH - 340 * s;

    // Yellow Swoosh Ribbon
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(cardX, botY + 34 * s);
    ctx.bezierCurveTo(
      cardX + cardW * 0.35,
      botY + 50 * s,
      cardX + cardW * 0.72,
      botY + 16 * s,
      cardX + cardW,
      botY - 24 * s
    );
    ctx.lineTo(cardX + cardW, botY - 10 * s);
    ctx.bezierCurveTo(
      cardX + cardW * 0.72,
      botY + 30 * s,
      cardX + cardW * 0.35,
      botY + 64 * s,
      cardX,
      botY + 48 * s
    );
    ctx.closePath();
    ctx.fill();

    // Brand Green Wave Base
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(cardX, botY + 42 * s);
    ctx.bezierCurveTo(
      cardX + cardW * 0.35,
      botY + 58 * s,
      cardX + cardW * 0.72,
      botY + 24 * s,
      cardX + cardW,
      botY - 14 * s
    );
    ctx.lineTo(cardX + cardW, cardY + cardH);
    ctx.lineTo(cardX, cardY + cardH);
    ctx.closePath();
    ctx.fill();

    // Subtle Wave Depth Layer
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.beginPath();
    ctx.moveTo(cardX, botY + 90 * s);
    ctx.quadraticCurveTo(cardX + cardW * 0.32, botY + 75 * s, cardX + cardW * 0.52, cardY + cardH);
    ctx.lineTo(cardX, cardY + cardH);
    ctx.closePath();
    ctx.fill();

    // 3 Action Steps: [1] Scan QR code > [2] Enter details > [3] Scratch & win
    const stepsY = botY + 148 * s;
    const step1X = width * 0.22;
    const step2X = width * 0.50;
    const step3X = width * 0.78;
    const circleR = 44 * s;

    const steps = [
      { num: '1', x: step1X, label: 'Scan QR code', drawIcon: drawPhoneIcon },
      { num: '2', x: step2X, label: 'Enter details', drawIcon: drawGiftIcon },
      { num: '3', x: step3X, label: 'Scratch & win', drawIcon: drawTicketIcon },
    ];

    steps.forEach((step) => {
      // White Circle Badge
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(step.x, stepsY, circleR, 0, Math.PI * 2);
      ctx.fill();

      // Top Number Badge
      const badgeY = stepsY - circleR;
      const badgeR = 14 * s;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.arc(step.x, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * s;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${14 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(step.num, step.x, badgeY + 0.5 * s);

      // Icon Inside Circle
      step.drawIcon(ctx, step.x, stepsY, 44 * s, bgColor);

      // Label Below Circle
      const labelY = stepsY + circleR + 26 * s;
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${16 * s}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(step.label, step.x, labelY);
    });

    // Sleek White Chevron Arrows between steps
    const drawChevron = (cx: number) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 4 * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 7 * s, stepsY - 12 * s);
      ctx.lineTo(cx + 7 * s, stepsY);
      ctx.lineTo(cx - 7 * s, stepsY + 12 * s);
      ctx.stroke();
    };

    drawChevron(width * 0.36);
    drawChevron(width * 0.64);

    // Footer Note: ── THANK YOU FOR SHOPPING WITH US ──
    const footerY = cardY + cardH - 36 * s;
    ctx.font = `700 ${13 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('──   THANK YOU FOR SHOPPING WITH US   ──', width / 2, footerY);

    // Card Outer Outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2 * s;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

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

      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center items-start bg-slate-100/70">
          <div
            id="standee-print-area"
            className={`w-full ${sizeConfig.containerClass} bg-white rounded-3xl text-center shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col justify-between`}
            style={{ minHeight: '580px' }}
          >
            {/* TOP BRAND BANNER */}
            <div style={{ backgroundColor: bgColor }} className="relative text-white pt-5 pb-2 px-4 text-center">
              {/* Merchant Logo Badge */}
              <div className="flex items-center justify-center">
                {effectiveLogo ? (
                  <img
                    src={effectiveLogo}
                    alt={shop.shop_name}
                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-contain bg-white p-1 border-2 border-white/90 shadow-md mx-auto"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center border-2 border-white/80 mx-auto shadow-md"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
                  >
                    <span className="text-2xl font-black text-white">
                      {shop.shop_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Shop Name */}
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-2 leading-tight">
                {shop.shop_name}
              </h2>

              {/* Tagline: EXCLUSIVE IN-STORE REWARDS */}
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className="h-[1px] w-6 bg-white/40" />
                <span className="text-[10px] sm:text-[11px] font-bold text-white/90 uppercase tracking-widest">
                  EXCLUSIVE IN-STORE REWARDS
                </span>
                <div className="h-[1px] w-6 bg-white/40" />
              </div>

              {/* Convex Wave Transition to White Section */}
              <div className="w-full relative mt-2.5" style={{ height: '18px', marginBottom: '-1px' }}>
                <svg className="w-full h-full block" viewBox="0 0 500 24" preserveAspectRatio="none">
                  <path d="M 0,0 L 0,22 Q 250,2 500,22 L 500,0 Z" fill={bgColor} />
                </svg>
              </div>
            </div>

            {/* MIDDLE WHITE CARD: "Scan & Win" + Sunburst Rays + QR Code */}
            <div className="px-4 py-2 sm:py-3 flex-1 flex flex-col items-center justify-center bg-white">
              {/* Headline: Scan & Win */}
              <div className="text-center">
                <div
                  className="text-2xl sm:text-3xl font-black tracking-tight leading-none"
                  style={{ color: bgColor }}
                >
                  Scan &
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  {/* Left Golden Sunburst Rays */}
                  <svg className="w-6 h-8 sm:w-7 sm:h-9 shrink-0" viewBox="0 0 28 40" fill="none">
                    <line x1="24" y1="10" x2="6" y2="4" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
                    <line x1="24" y1="20" x2="4" y2="20" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
                    <line x1="24" y1="30" x2="6" y2="36" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
                  </svg>

                  <span className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: '#16A34A' }}>
                    Win
                  </span>

                  {/* Right Golden Sunburst Rays */}
                  <svg className="w-6 h-8 sm:w-7 sm:h-9 shrink-0" viewBox="0 0 28 40" fill="none">
                    <line x1="4" y1="10" x2="22" y2="4" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
                    <line x1="4" y1="20" x2="24" y2="20" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
                    <line x1="4" y1="30" x2="22" y2="36" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                </div>

                <p className="text-[11px] sm:text-xs font-bold text-slate-700 tracking-wide mt-1">
                  Instant Discounts &nbsp;|&nbsp; Exclusive Vouchers &nbsp;|&nbsp; Special Offers
                </p>
              </div>

              {/* Prominent Large QR Code in Rounded Green Box */}
              <div className="my-2.5 sm:my-3">
                <div
                  className="bg-white p-3 sm:p-3.5 rounded-[26px] shadow-lg inline-block mx-auto border-[5px]"
                  style={{ borderColor: bgColor }}
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
                            height: 38,
                            width: 38,
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
              <div className="w-full relative" style={{ height: '30px', marginTop: '-29px', marginBottom: '-1px' }}>
                <svg className="w-full h-full block" viewBox="0 0 500 40" preserveAspectRatio="none">
                  {/* Yellow Ribbon */}
                  <path
                    d="M 0,34 Q 180,44 340,24 Q 420,14 500,2 L 500,10 Q 420,20 340,30 Q 180,50 0,40 Z"
                    fill="#FBBF24"
                  />
                  {/* Green Wave Base */}
                  <path
                    d="M 0,38 Q 180,47 340,28 Q 420,18 500,7 L 500,40 L 0,40 Z"
                    fill={bgColor}
                  />
                </svg>
              </div>

              <div className="px-4 pb-4 pt-1 relative z-10">
                {/* 3 Step Action Badges: [1] Phone > [2] Gift > [3] Ticket % */}
                <div className="flex items-center justify-center gap-1 sm:gap-2 max-w-sm mx-auto">
                  {/* Step 1 */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center relative shadow-md">
                      <div
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white text-[9px] sm:text-[10px] font-black border border-white"
                        style={{ backgroundColor: bgColor }}
                      >
                        1
                      </div>
                      <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: bgColor }} />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-wide mt-1.5">
                      Scan QR code
                    </span>
                  </div>

                  {/* Arrow 1 */}
                  <ChevronRight className="w-4 h-4 text-white/70 shrink-0 -mt-3.5" />

                  {/* Step 2 */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center relative shadow-md">
                      <div
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white text-[9px] sm:text-[10px] font-black border border-white"
                        style={{ backgroundColor: bgColor }}
                      >
                        2
                      </div>
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: bgColor }} />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-wide mt-1.5">
                      Enter details
                    </span>
                  </div>

                  {/* Arrow 2 */}
                  <ChevronRight className="w-4 h-4 text-white/70 shrink-0 -mt-3.5" />

                  {/* Step 3 */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center relative shadow-md">
                      <div
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white text-[9px] sm:text-[10px] font-black border border-white"
                        style={{ backgroundColor: bgColor }}
                      >
                        3
                      </div>
                      <div className="relative flex items-center justify-center">
                        <Ticket className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: bgColor }} />
                        <span className="absolute text-[8px] font-black" style={{ color: bgColor }}>%</span>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-wide mt-1.5">
                      Scratch & win
                    </span>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="mt-3.5 flex items-center justify-center gap-2">
                  <div className="h-[1px] w-8 bg-white/40" />
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-white/90">
                    THANK YOU FOR SHOPPING WITH US
                  </span>
                  <div className="h-[1px] w-8 bg-white/40" />
                </div>
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
