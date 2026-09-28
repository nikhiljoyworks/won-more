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
 * Resize image file to max dimensions and return lightweight compressed base64 data URL
 */
export function resizeImageFile(file: File, maxWidth = 500, maxHeight = 500, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
