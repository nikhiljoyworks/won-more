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

/**
 * Build WhatsApp Claim wa.me URL
 * Crucial Logic: wa.me/[SHOP_WHATSAPP_NUMBER]?text=[URL_ENCODED_MESSAGE]
 * Message: "Hello! I just scratched and won [Reward Name] on Won More! My redemption code is [Redemption Code]. Name: [Customer Name]."
 */
export function buildWhatsAppClaimUrl(
  shopPhone: string,
  rewardName: string,
  redemptionCode: string,
  customerName: string
): string {
  // Strip non-digits except +
  const cleanPhone = shopPhone.replace(/[^\d]/g, '');
  const message = `Hello! I just scratched and won ${rewardName} on Won More! My redemption code is ${redemptionCode}. Name: ${customerName}.`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Export Leads array to downloadable CSV
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
  
  const rows = leads.map(l => {
    const storeName = l.campaigns?.shops?.shop_name || '';
    const campName = l.campaigns?.title || l.campaign?.title || '';
    const customDetails = l.custom_data && Object.keys(l.custom_data).length > 0
      ? Object.entries(l.custom_data).map(([k, v]) => `${k}: ${v}`).join(' | ')
      : '';

    return [
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
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
