export type PlanStatus = 'pending' | 'active' | 'paused' | 'suspended';
export type PlanTier = 'starter' | 'growth' | 'pro';
export type LeadStatus = 'unscratched' | 'pending' | 'claimed';

export interface CustomerFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'date' | 'email' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billing_interval: 'month' | 'year' | 'one-time';
  campaigns_limit: number;
  leads_limit: number;
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at?: string;
}

export interface Shop {
  id: string;
  shop_name: string;
  slug: string;
  email: string;
  password_pin: string;
  whatsapp_number: string;
  logo_url?: string | null;
  plan_status: PlanStatus;
  plan_tier: PlanTier | string;
  subscription_expires_at: string | null;
  created_at: string;
  timezone?: string;
  // Aggregate counts for admin
  campaigns_count?: number;
  leads_count?: number;
}

export interface RequiredAction {
  platform: 'Instagram' | 'Facebook' | 'Google Maps' | 'TikTok' | 'Website' | string;
  label: string;
  url: string;
}

export interface PrizeQueueItem {
  reward_id: string;
  reward_name: string;
  win_code_prefix: string;
  image_url?: string | null;
  description?: string | null;
}

export interface Campaign {
  id: string;
  shop_id: string;
  title: string;
  slug: string;
  logo_url: string | null;
  background_color?: string;
  button_color?: string;
  customer_fields?: CustomerFieldConfig[];
  required_actions: RequiredAction[];
  required_fields: ('name' | 'phone' | 'email')[];
  is_active: boolean;
  is_archived?: boolean;
  archived_at?: string | null;
  unique_phone_only?: boolean;
  whatsapp_message_template?: string | null;
  campaign_type?: 'offline' | 'online';
  website_url?: string | null;
  website_button_text?: string | null;
  claim_instructions?: string | null;
  header_tagline?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  prize_queue: PrizeQueueItem[];
  next_prize_override_reward_id: string | null;
  created_at: string;
  // Joined relations
  shops?: Shop;
  rewards?: Reward[];
  leads?: { count: number }[] | Lead[];
}

export interface Reward {
  id: string;
  campaign_id: string;
  reward_name: string;
  probability_percentage?: number;
  win_code_prefix: string;
  is_default?: boolean;
  coupon_mode?: 'unique_pool' | 'fixed_code';
  coupon_code?: string | null;
  image_url?: string | null;
  description?: string | null;
  allocated_qty: number;
  supplied_qty: number;
  max_limit: number;
  daily_limit: number;
  hourly_limit: number;
  weight: number;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Lead {
  id: string;
  campaign_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  custom_data?: Record<string, any>;
  reward_won: string;
  redemption_code: string;
  status: LeadStatus;
  created_at: string;
  campaign?: {
    id: string;
    title: string;
    slug: string;
  };
  campaigns?: {
    id: string;
    title: string;
    slug: string;
    shops?: {
      id: string;
      shop_name: string;
      slug: string;
      whatsapp_number: string;
    };
  };
}

export interface PlayScratchResult {
  lead_id: string;
  reward_won: string;
  redemption_code: string;
  customer_name: string;
  image_url?: string | null;
  description?: string | null;
  is_loss?: boolean;
}
