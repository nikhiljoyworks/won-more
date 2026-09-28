import { createClient } from '@supabase/supabase-js';
import { Campaign, Shop, PlayScratchResult, Lead } from '../types';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://spxbplkjwqnhmefdujbw.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweGJwbGtqd3FuaG1lZmR1amJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MDIxNTUsImV4cCI6MjEwNTk3ODE1NX0.JTaa4XGy4Hhr3Qg7JK38xsSUKR99O_lYEv0VCYe8wMc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Public fields for shop (explicitly excluding sensitive fields like password_pin)
 */
export const PUBLIC_SHOP_COLUMNS = 'id, shop_name, slug, email, whatsapp_number, logo_url, plan_status, plan_tier, subscription_expires_at, created_at';

/**
 * Fetch campaign with shop and rewards by shopSlug and campaignSlug
 * SECURE: Never selects password_pin to prevent credential leakage to visitors
 */
export async function getCampaignBySlugs(shopSlug: string, campaignSlug: string) {
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select(PUBLIC_SHOP_COLUMNS)
    .eq('slug', shopSlug.trim().toLowerCase())
    .single();

  if (shopErr || !shop) {
    throw new Error('Shop not found');
  }

  // Explicit foreign key constraint to avoid PostgREST PGRST201 embedding ambiguity
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select(`
      *,
      rewards:rewards!rewards_campaign_id_fkey (*)
    `)
    .eq('shop_id', shop.id)
    .eq('slug', campaignSlug.trim().toLowerCase())
    .single();

  if (campErr || !campaign) {
    console.error('getCampaignBySlugs error:', campErr);
    throw new Error(campErr?.message || 'Campaign not found');
  }

  return { shop: shop as Shop, campaign: campaign as Campaign };
}

/**
 * Fetch campaign by ID
 * SECURE: Never selects password_pin
 */
export async function getCampaignById(campaignId: string) {
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select(`
      *,
      shops (${PUBLIC_SHOP_COLUMNS}),
      rewards:rewards!rewards_campaign_id_fkey (*)
    `)
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) {
    throw new Error(campErr?.message || 'Campaign not found');
  }

  return campaign as Campaign;
}

/**
 * Play scratch and compute prize on backend RPC
 */
export async function playScratchRpc(
  campaignId: string,
  customerName: string,
  customerPhone: string,
  customerEmail?: string,
  customData?: Record<string, any>
): Promise<PlayScratchResult> {
  const { data, error } = await supabase.rpc('play_scratch', {
    p_campaign_id: campaignId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_email: customerEmail || null,
    p_custom_data: customData || {},
  });

  if (error) {
    throw new Error(error.message || 'Failed to process scratch');
  }

  return data as PlayScratchResult;
}

/**
 * Mark scratch card as revealed/scratched (moves lead status from unscratched to pending)
 */
export async function revealScratchRpc(leadId: string) {
  const { error } = await supabase.rpc('reveal_scratch', {
    p_lead_id: leadId,
  });
  if (error) {
    console.error('revealScratch error:', error);
  }
}

/**
 * Check if a merchant store has reached its monthly leads quota
 */
export async function checkShopLeadsQuotaRpc(
  shopId: string
): Promise<{ is_quota_reached: boolean; lead_count?: number; max_leads?: number }> {
  try {
    const { data, error } = await supabase.rpc('check_shop_leads_quota', {
      p_shop_id: shopId,
    });
    if (error || !data) return { is_quota_reached: false };
    return data as { is_quota_reached: boolean; lead_count?: number; max_leads?: number };
  } catch {
    return { is_quota_reached: false };
  }
}

/**
 * SECURE: Merchant Login RPC (checks credentials on server, tracks rate limits, returns session token)
 */
export async function loginMerchantRpc(
  email: string,
  pin: string,
  ip: string
): Promise<{
  success: boolean;
  token?: string;
  shop?: Shop;
  error?: string;
  is_blocked?: boolean;
  remaining_seconds?: number;
  email_not_found?: boolean;
}> {
  const { data, error } = await supabase.rpc('login_merchant', {
    p_email: email.trim().toLowerCase(),
    p_pin: pin.trim(),
    p_ip: ip || 'unknown',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return (data || {}) as {
    success: boolean;
    token?: string;
    shop?: Shop;
    error?: string;
    is_blocked?: boolean;
    remaining_seconds?: number;
    email_not_found?: boolean;
  };
}

/**
 * Check if a merchant email exists in the shops registry
 */
export async function checkMerchantEmailExists(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  try {
    const { data } = await supabase
      .from('shops')
      .select('id')
      .eq('email', clean)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * SECURE: Verify Merchant Session Token on database
 */
export async function verifyMerchantSessionRpc(
  token: string
): Promise<{ valid: boolean; shop?: Shop }> {
  const { data, error } = await supabase.rpc('verify_merchant_session', {
    p_token: token,
  });

  if (error || !data?.valid) {
    return { valid: false };
  }

  return { valid: true, shop: data.shop as Shop };
}

/**
 * SECURE: Logout Merchant (invalidates session token)
 */
export async function logoutMerchantRpc(token: string) {
  try {
    await supabase.rpc('logout_merchant', { p_token: token });
  } catch {
    // Ignore error on logout
  }
}

/**
 * SECURE: Fetch merchant leads using verified session token
 */
export async function getMerchantLeadsRpc(
  sessionToken: string,
  campaignId?: string | null
): Promise<Lead[]> {
  const { data, error } = await supabase.rpc('get_merchant_leads', {
    p_session_token: sessionToken,
    p_campaign_id: campaignId && campaignId !== 'all' ? campaignId : null,
  });

  if (error) {
    console.error('getMerchantLeads error:', error);
    return [];
  }

  return (data || []) as Lead[];
}

/**
 * SECURE: Update lead status using verified session token
 */
export async function updateLeadStatusRpc(
  sessionToken: string,
  leadId: string,
  status: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('update_lead_status_secure', {
    p_session_token: sessionToken,
    p_lead_id: leadId,
    p_status: status,
  });

  if (error) {
    console.error('updateLeadStatus error:', error);
    return false;
  }

  return !!data;
}

/**
 * SECURE: Set next prize override using verified session token
 */
export async function setNextPrizeSecureRpc(
  sessionToken: string,
  campaignId: string,
  rewardId: string
) {
  const { error } = await supabase.rpc('set_next_prize_secure', {
    p_session_token: sessionToken,
    p_campaign_id: campaignId,
    p_reward_id: rewardId,
  });
  if (error) throw error;
}

/**
 * SECURE: Clear next prize override using verified session token
 */
export async function clearNextPrizeSecureRpc(
  sessionToken: string,
  campaignId: string
) {
  const { error } = await supabase.rpc('clear_next_prize_secure', {
    p_session_token: sessionToken,
    p_campaign_id: campaignId,
  });
  if (error) throw error;
}

/**
 * Reshuffle prize queue
 */
export async function reshufflePrizeQueueRpc(campaignId: string) {
  const { error } = await supabase.rpc('replenish_prize_queue', {
    p_campaign_id: campaignId,
  });
  if (error) {
    console.error('reshufflePrizeQueueRpc error:', error);
  }
}

/**
 * SECURE: Fetch all leads for Admin using verified admin secret/token
 */
export async function getAllAdminLeadsRpc(adminSecret: string): Promise<Lead[]> {
  const { data, error } = await supabase.rpc('get_all_admin_leads', {
    p_admin_secret: adminSecret,
  });

  if (error) {
    console.error('getAllAdminLeads error:', error);
    return [];
  }

  return (data || []) as Lead[];
}

/**
 * SECURE: Admin Create Shop RPC
 */
export async function adminCreateShopRpc(
  adminSecret: string,
  payload: {
    shop_name: string;
    slug: string;
    email: string;
    whatsapp_number: string;
    logo_url: string;
    plan_tier: string;
    duration_days: number;
    pin: string;
  }
): Promise<Shop> {
  const { data, error } = await supabase.rpc('admin_create_shop', {
    p_admin_secret: adminSecret,
    p_shop_name: payload.shop_name,
    p_slug: payload.slug,
    p_email: payload.email,
    p_whatsapp: payload.whatsapp_number,
    p_logo_url: payload.logo_url || null,
    p_plan_tier: payload.plan_tier,
    p_duration_days: payload.duration_days,
    p_pin: payload.pin,
  });

  if (error) throw error;
  return data as Shop;
}

/**
 * SECURE: Admin Update Shop RPC
 */
export async function adminUpdateShopRpc(
  adminSecret: string,
  payload: {
    id: string;
    shop_name: string;
    slug: string;
    email: string;
    whatsapp_number: string;
    logo_url: string;
    plan_tier: string;
    plan_status: string;
    subscription_expires_at: string | null;
    password_pin: string;
  }
): Promise<Shop> {
  const { data, error } = await supabase.rpc('admin_update_shop', {
    p_admin_secret: adminSecret,
    p_shop_id: payload.id,
    p_shop_name: payload.shop_name,
    p_slug: payload.slug,
    p_email: payload.email,
    p_whatsapp: payload.whatsapp_number,
    p_logo_url: payload.logo_url || null,
    p_plan_tier: payload.plan_tier,
    p_plan_status: payload.plan_status,
    p_expires_at: payload.subscription_expires_at,
    p_pin: payload.password_pin,
  });

  if (error) throw error;
  return data as Shop;
}

/**
 * SECURE: Admin Delete Shop RPC
 */
export async function adminDeleteShopRpc(
  adminSecret: string,
  shopId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_delete_shop', {
    p_admin_secret: adminSecret,
    p_shop_id: shopId,
  });

  if (error) throw error;
  return !!data;
}
