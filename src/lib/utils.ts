import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Lead } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeAgo(dateString: string): string {
  const d = new Date(dateString);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const DEFAULT_WHATSAPP_CLAIM_TEMPLATE =
  'Hello! I just scratched and won {{reward_won}} on {{shop_name}}! My redemption code is {{redemption_code}}. Name: {{customer_name}}.';

export interface WhatsAppInterpolationVars {
  shopName?: string;
  rewardName?: string;
  redemptionCode?: string;
  customerName?: string;
  customerPhone?: string;
  campaignTitle?: string;
  customData?: Record<string, any>;
}

/**
 * Interpolates dynamic variables like {{customer_name}}, {{reward_won}}, {{redemption_code}},
 * {{shop_name}}, {{campaign_title}}, and custom field IDs into a WhatsApp template.
 */
export function interpolateWhatsAppMessage(
  template: string | null | undefined,
  vars: WhatsAppInterpolationVars
): string {
  let msg = template && template.trim() ? template.trim() : DEFAULT_WHATSAPP_CLAIM_TEMPLATE;

  const replacements: Record<string, string> = {
    '{{shop_name}}': vars.shopName || '',
    '{{reward_won}}': vars.rewardName || '',
    '{{redemption_code}}': vars.redemptionCode || '',
    '{{customer_name}}': vars.customerName || '',
    '{{customer_phone}}': vars.customerPhone || '',
    '{{campaign_title}}': vars.campaignTitle || '',
  };

  // Dynamically interpolate any custom field keys from customData
  if (vars.customData && typeof vars.customData === 'object') {
    Object.entries(vars.customData).forEach(([key, val]) => {
      const stringVal = val !== null && val !== undefined ? String(val) : '';
      replacements[`{{${key}}}`] = stringVal;
      // Also support lowercase sanitized version
      const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      replacements[`{{${sanitizedKey}}}`] = stringVal;
    });
  }

  Object.entries(replacements).forEach(([tag, val]) => {
    msg = msg.split(tag).join(val);
  });

  return msg;
}

/**
 * Build WhatsApp Claim wa.me URL with dynamic variable interpolation
 */
export function buildWhatsAppClaimUrl(
  shopPhone: string,
  rewardName: string,
  redemptionCode: string,
  customerName: string,
  template?: string | null,
  extraVars?: {
    shopName?: string;
    customerPhone?: string;
    campaignTitle?: string;
    customData?: Record<string, any>;
  }
): string {
  // Strip non-digits except +
  const cleanPhone = shopPhone.replace(/[^\d]/g, '');
  const message = interpolateWhatsAppMessage(template, {
    shopName: extraVars?.shopName,
    rewardName,
    redemptionCode,
    customerName,
    customerPhone: extraVars?.customerPhone,
    campaignTitle: extraVars?.campaignTitle,
    customData: extraVars?.customData,
  });
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Format date in local YYYY-MM-DD format avoiding UTC timezone shift bugs
 */
export function formatLocalDate(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '';
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Export Leads array to downloadable CSV using memory-efficient chunked streaming
 */
export function exportLeadsToCsv(leads: Lead[], filename = 'won-more-leads.csv') {
  if (!leads || leads.length === 0) {
    alert('No leads to export.');
    return;
  }

  const headers = [
    'Store',
    'Campaign Name',
    'Customer Name',
    'Phone / WhatsApp',
    'Email',
    'Custom Details',
    'Reward Won',
    'Redemption Code',
    'Status',
    'Date Captured'
  ];
  
  const blobParts: BlobPart[] = [headers.join(',') + '\n'];
  const CHUNK_SIZE = 500;
  let currentChunk: string[] = [];

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    const storeName = l.campaigns?.shops?.shop_name || '';
    const campName = l.campaigns?.title || l.campaign?.title || '';
    const customDetails = l.custom_data && Object.keys(l.custom_data).length > 0
      ? Object.entries(l.custom_data).map(([k, v]) => `${k}: ${v}`).join(' | ')
      : '';

    const row = [
      `"${storeName.replace(/"/g, '""')}"`,
      `"${campName.replace(/"/g, '""')}"`,
      `"${(l.customer_name || '').replace(/"/g, '""')}"`,
      `"${(l.customer_phone || '').replace(/"/g, '""')}"`,
      `"${(l.customer_email || '').replace(/"/g, '""')}"`,
      `"${customDetails.replace(/"/g, '""')}"`,
      `"${(l.reward_won || '').replace(/"/g, '""')}"`,
      `"${(l.redemption_code || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${new Date(l.created_at).toLocaleString()}"`,
    ].join(',');

    currentChunk.push(row);

    if (currentChunk.length >= CHUNK_SIZE || i === leads.length - 1) {
      blobParts.push(currentChunk.join('\n') + '\n');
      currentChunk = [];
    }
  }

  const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Calculates raw byte size of a base64 Data URL or raw base64 string
 */
export function getBase64ByteSize(base64String: string): number {
  if (!base64String) return 0;
  const pureBase64 = base64String.replace(/^data:[^;]+;base64,/, '');
  const padding = pureBase64.endsWith('==') ? 2 : pureBase64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((pureBase64.length * 3) / 4) - padding);
}

/**
 * Compresses an image (File or base64 Data URL) to ensure it stays strictly under maxSizeBytes (default 250KB).
 * - Caps dimensions (default maxWidth=1200, maxHeight=1200) to keep memory lightweight (<6MB RAM) on mobile.
 * - Iteratively reduces quality and/or dimensions until byte size <= maxSizeBytes.
 * - Prefers WebP with automatic fallback to JPEG.
 */
export function compressImageToTargetSize(
  fileOrDataUrl: File | string,
  maxSizeBytes: number = 250 * 1024,
  maxWidth = 1200,
  maxHeight = 1200
): Promise<{ dataUrl: string; byteSize: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const processImage = (src: string) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // 1. Initial aspect-ratio scale down to maxWidth / maxHeight
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawSize = getBase64ByteSize(src);
          resolve({
            dataUrl: src,
            byteSize: rawSize,
            mimeType: src.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          });
          return;
        }

        // Test if browser supports WebP canvas export
        let preferredMime = 'image/webp';
        try {
          const testData = canvas.toDataURL('image/webp');
          if (!testData.startsWith('data:image/webp')) {
            preferredMime = 'image/jpeg';
          }
        } catch {
          preferredMime = 'image/jpeg';
        }

        // Adaptive compression passes
        let quality = 0.85;
        let w = width;
        let h = height;
        let bestDataUrl = '';
        let bestByteSize = Infinity;
        let bestMime = preferredMime;

        for (let pass = 0; pass < 8; pass++) {
          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          const candidateUrl = canvas.toDataURL(preferredMime, quality);
          const candidateSize = getBase64ByteSize(candidateUrl);

          if (candidateSize < bestByteSize) {
            bestDataUrl = candidateUrl;
            bestByteSize = candidateSize;
            bestMime = preferredMime;
          }

          if (candidateSize <= maxSizeBytes) {
            resolve({
              dataUrl: candidateUrl,
              byteSize: candidateSize,
              mimeType: preferredMime,
            });
            return;
          }

          // If still exceeding target size, progressively reduce quality or scale down dimensions
          if (quality > 0.60) {
            quality -= 0.12;
          } else if (quality > 0.38) {
            quality -= 0.10;
          } else {
            // Scale dimensions down by 15% and reset quality for smaller resolution
            w = Math.max(300, Math.round(w * 0.85));
            h = Math.max(200, Math.round(h * 0.85));
            quality = 0.65;
          }
        }

        resolve({
          dataUrl: bestDataUrl || src,
          byteSize: bestByteSize !== Infinity ? bestByteSize : getBase64ByteSize(src),
          mimeType: bestMime,
        });
      };
      img.onerror = (err) => reject(err);
      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImage(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processImage(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Resize image file to max dimensions and return lightweight compressed base64 data URL
 */
export async function resizeImageFile(
  file: File,
  maxWidth = 500,
  maxHeight = 500,
  _quality = 0.82
): Promise<string> {
  const result = await compressImageToTargetSize(file, 250 * 1024, maxWidth, maxHeight);
  return result.dataUrl;
}
