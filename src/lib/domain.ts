/**
 * Utility to parse shop subdomain and campaign slugs
 */
export function getSubdomainInfo(): { isSubdomain: boolean; shopSlug: string | null } {
  if (typeof window === 'undefined') return { isSubdomain: false, shopSlug: null };

  const hostname = window.location.hostname.toLowerCase();
  const parts = hostname.split('.');
  
  // Local development check: e.g. "urban-roast.localhost" or custom hosts
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www') {
      return { isSubdomain: true, shopSlug: parts[0] };
    }
    return { isSubdomain: false, shopSlug: null };
  }

  // Cloudflare development domains (*.workers.dev or *.pages.dev) are base hostnames, not shop subdomains
  if (hostname.endsWith('.workers.dev') || hostname.endsWith('.pages.dev')) {
    return { isSubdomain: false, shopSlug: null };
  }

  const configuredDomain = (import.meta.env.VITE_APP_DOMAIN || 'wonmore.com').toLowerCase().replace(/^https?:\/\//, '');

  // If running on root configured domain (e.g. wonmore.com or www.wonmore.com)
  if (hostname === configuredDomain || hostname === `www.${configuredDomain}`) {
    return { isSubdomain: false, shopSlug: null };
  }

  // If running on a shop subdomain of the configured domain (e.g. {shopSlug}.wonmore.com)
  if (hostname.endsWith(`.${configuredDomain}`)) {
    const sub = hostname.replace(`.${configuredDomain}`, '');
    const reserved = ['www', 'app', 'admin', 'api', 'staging', 'preview', 'mail'];
    if (!reserved.includes(sub) && !sub.includes('.')) {
      return { isSubdomain: true, shopSlug: sub };
    }
  }

  return { isSubdomain: false, shopSlug: null };
}

/**
 * Build canonical campaign display and QR URL
 * In production: https://{shopSlug}.wonmore.com/{campaignSlug}
 * In local dev / workers.dev / pages.dev: {origin}/{shopSlug}/{campaignSlug}
 */
export function buildCampaignUrl(shopSlug: string, campaignSlug: string, options?: { forceSubdomain?: boolean }): string {
  const domain = (import.meta.env.VITE_APP_DOMAIN || 'wonmore.com').toLowerCase().replace(/^https?:\/\//, '');
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    const isLocal = hostname.includes('localhost') || hostname === '127.0.0.1';
    const isCloudflareDev = hostname.endsWith('.workers.dev') || hostname.endsWith('.pages.dev');
    
    // In local development or *.workers.dev / *.pages.dev, prefer clean path URL for instant browsing
    if ((isLocal || isCloudflareDev) && !options?.forceSubdomain) {
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
