import { createClient } from '@supabase/supabase-js';
import { Campaign, Lead, Reward, Shop, PlayScratchResult } from '../types';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://spxbplkjwqnhmefdujbw.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweGJwbGtqd3FuaG1lZmR1amJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MDIxNTUsImV4cCI6MjEwNTk3ODE1NX0.JTaa4XGy4Hhr3Qg7JK38xsSUKR99O_lYEv0VCYe8wMc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetch campaign with shop and rewards by shopSlug and campaignSlug
 */
export async function getCampaignBySlugs(shopSlug: string, campaignSlug: string) {
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select('*')
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
 */
export async function getCampaignById(campaignId: string) {
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select(`
      *,
      shops (*),
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
 * Set next prize override for shop owner
 */
export async function setNextPrizeRpc(campaignId: string, rewardId: string) {
  const { error } = await supabase.rpc('set_next_prize', {
    p_campaign_id: campaignId,
    p_reward_id: rewardId,
  });
  if (error) throw error;
}

/**
 * Clear next prize override
 */
export async function clearNextPrizeRpc(campaignId: string) {
  const { error } = await supabase.rpc('clear_next_prize', {
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
  if (error) throw error;
}
