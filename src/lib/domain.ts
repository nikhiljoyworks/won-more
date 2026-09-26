/**
 * Utility to parse shop subdomain and campaign slugs
 */
export function getSubdomainInfo(): { isSubdomain: boolean; shopSlug: string | null } {
  if (typeof window === 'undefined') return { isSubdomain: false, shopSlug: null };

  const hostname = window.location.hostname;
  
  // Local development check: e.g. "urban-roast.localhost" or custom hosts
  const parts = hostname.split('.');
  
  // If hosted on localhost or raw IP, check if subdomain was prefixed
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www') {
      return { isSubdomain: true, shopSlug: parts[0].toLowerCase() };
    }
    return { isSubdomain: false, shopSlug: null };
  }

  // Production check: e.g. "urban-roast.wonmore.com" or "urban-roast.pages.dev"
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (sub !== 'www' && sub !== 'app' && sub !== 'admin') {
      return { isSubdomain: true, shopSlug: sub };
    }
  }

  return { isSubdomain: false, shopSlug: null };
}

/**
 * Build canonical campaign display and QR URL
 * In production: https://{shopSlug}.wonmore.com/{campaignSlug}
 * In local dev / fallback: {origin}/{shopSlug}/{campaignSlug}
 */
export function buildCampaignUrl(shopSlug: string, campaignSlug: string, options?: { forceSubdomain?: boolean }): string {
  const domain = import.meta.env.VITE_APP_DOMAIN || 'wonmore.com';
  
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1';
    
    // In local development, prefer clean path URL for easy clicking
    if (isLocal && !options?.forceSubdomain) {
      return `${window.location.origin}/${shopSlug}/${campaignSlug}`;
    }
  }

  // Branded subdomain URL
  return `https://${shopSlug}.${domain}/${campaignSlug}`;
}

/**
 * Build direct navigable URL that works in current environment
 */
export function getNavigableCampaignUrl(shopSlug: string, campaignSlug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/${shopSlug}/${campaignSlug}`;
  }
  return `https://${shopSlug}.wonmore.com/${campaignSlug}`;
}
