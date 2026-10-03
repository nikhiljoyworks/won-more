import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Campaign, Reward, ShopPrize, SubscriptionPlan } from '../types';
import { supabase, getMerchantDashboardTelemetryRpc, MerchantDashboardTelemetry } from '../lib/supabase';
import { useMerchantAuth } from './MerchantAuthContext';
import { subscribeToShopLeads, playNotificationChime } from '../lib/realtime';
import { toast } from './ToastContext';

interface MerchantDataContextType {
  // Core state
  campaigns: Campaign[];
  allRewards: Reward[];
  shopPrizes: ShopPrize[];
  currentPlan: SubscriptionPlan | null;
  campaignsLimit: number;
  leadsLimit: number;
  selectedCampaignId: string;
  setSelectedCampaignId: (id: string) => void;
  telemetry: MerchantDashboardTelemetry | null;
  isLoading: boolean;
  isInitialLoaded: boolean;

  // Refresh actions for targeted cache invalidation
  refreshCampaigns: () => Promise<void>;
  refreshPrizes: () => Promise<void>;
  refreshTelemetry: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  setTelemetry: React.Dispatch<React.SetStateAction<MerchantDashboardTelemetry | null>>;
  registerLeadListener: (callbacks: {
    onNewLead?: (lead?: any) => void;
    onStatusUpdated?: (leadId: string, status: string) => void;
  }) => () => void;
}

const MerchantDataContext = createContext<MerchantDataContextType | undefined>(undefined);

export const MerchantDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shop, sessionToken } = useMerchantAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allRewards, setAllRewards] = useState<Reward[]>([]);
  const [shopPrizes, setShopPrizes] = useState<ShopPrize[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [campaignsLimit, setCampaignsLimit] = useState<number>(1);
  const [leadsLimit, setLeadsLimit] = useState<number>(500);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [telemetry, setTelemetry] = useState<MerchantDashboardTelemetry | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialLoaded, setIsInitialLoaded] = useState<boolean>(false);

  // Keep a ref to current selectedCampaignId for background callbacks
  const selectedCampRef = useRef(selectedCampaignId);
  useEffect(() => {
    selectedCampRef.current = selectedCampaignId;
  }, [selectedCampaignId]);

  // 1. Fetch campaigns and rewards
  const fetchCampaigns = useCallback(async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          rewards:rewards!rewards_campaign_id_fkey (*),
          leads (count)
        `)
        .eq('shop_id', shop.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let currentCamps = data || [];

      // Auto-create initial campaign on first merchant signup if zero ever existed
      if (currentCamps.length === 0) {
        const { count: totalEver } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id);

        if ((totalEver || 0) === 0) {
          const { data: newCamp } = await supabase
            .from('campaigns')
            .insert({
              shop_id: shop.id,
              title: `${shop.shop_name} Rewards`,
              slug: 'rewards',
              required_actions: [
                { platform: 'Instagram', label: 'Follow our Instagram', url: 'https://instagram.com' },
              ],
              required_fields: ['name', 'phone'],
              is_active: true,
            })
            .select()
            .single();

          if (newCamp) {
            currentCamps = [newCamp as Campaign];
            await supabase.from('rewards').insert([
              {
                campaign_id: newCamp.id,
                reward_name: 'Better Luck Next Time',
                probability_percentage: 100,
                weight: 100,
                win_code_prefix: 'TRY',
                allocated_qty: 10000,
                supplied_qty: 0,
                max_limit: 10000,
                daily_limit: 10000,
                hourly_limit: 10000,
                is_default: true,
                is_active: true,
              },
            ]);
            await supabase.rpc('replenish_prize_queue', { p_campaign_id: newCamp.id });
          }
        }
      }

      setCampaigns(currentCamps);

      // Flatten rewards
      const flatRewards = currentCamps.flatMap((c) => c.rewards || []);
      setAllRewards(flatRewards);
    } catch (err) {
      console.error('MerchantDataContext fetchCampaigns error:', err);
    }
  }, [shop?.id, shop?.shop_name]);

  // 2. Fetch master prizes catalog
  const fetchShopPrizes = useCallback(async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await supabase
        .from('shop_prizes')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setShopPrizes(data);
      }
    } catch (err) {
      console.error('MerchantDataContext fetchShopPrizes error:', err);
    }
  }, [shop?.id]);

  // 3. Fetch plan limits
  const fetchPlan = useCallback(async () => {
    if (!shop?.plan_tier) return;
    try {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .ilike('slug', shop.plan_tier)
        .maybeSingle();

      if (data) {
        setCurrentPlan(data);
        if (data.campaigns_limit != null) setCampaignsLimit(data.campaigns_limit);
        if (data.leads_limit != null) setLeadsLimit(data.leads_limit);
      }
    } catch (err) {
      console.error('MerchantDataContext fetchPlan error:', err);
    }
  }, [shop?.plan_tier]);

  // 4. Fetch telemetry (high-speed Postgres aggregation)
  const fetchTelemetry = useCallback(async (campId?: string) => {
    if (!sessionToken) return;
    try {
      const targetCampId = campId !== undefined ? campId : selectedCampRef.current;
      const data = await getMerchantDashboardTelemetryRpc(sessionToken, targetCampId);
      setTelemetry(data);
    } catch (err) {
      console.error('MerchantDataContext fetchTelemetry error:', err);
    }
  }, [sessionToken]);

  // Refresh all
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchCampaigns(),
      fetchShopPrizes(),
      fetchPlan(),
      fetchTelemetry(),
    ]);
  }, [fetchCampaigns, fetchShopPrizes, fetchPlan, fetchTelemetry]);

  // Initial parallel load on mount or shop change
  useEffect(() => {
    if (!shop?.id || !sessionToken) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      fetchCampaigns(),
      fetchShopPrizes(),
      fetchPlan(),
      fetchTelemetry('all'),
    ]).finally(() => {
      if (isMounted) {
        setIsLoading(false);
        setIsInitialLoaded(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [shop?.id, sessionToken, fetchCampaigns, fetchShopPrizes, fetchPlan, fetchTelemetry]);

  // Re-fetch telemetry when selectedCampaignId changes (lightweight 1ms query)
  useEffect(() => {
    if (isInitialLoaded && sessionToken) {
      fetchTelemetry(selectedCampaignId);
    }
  }, [selectedCampaignId, isInitialLoaded, sessionToken, fetchTelemetry]);

  // Dynamic listener registry for tabs that need live lead events (e.g. MerchantLeads table)
  const leadListenersRef = useRef<Set<{
    onNewLead?: (lead?: any) => void;
    onStatusUpdated?: (leadId: string, status: string) => void;
  }>>(new Set());

  const registerLeadListener = useCallback((callbacks: {
    onNewLead?: (lead?: any) => void;
    onStatusUpdated?: (leadId: string, status: string) => void;
  }) => {
    leadListenersRef.current.add(callbacks);
    return () => {
      leadListenersRef.current.delete(callbacks);
    };
  }, []);

  // Centralized Single Persistent Realtime Stream
  useEffect(() => {
    if (!shop?.id) return;

    const unsubscribe = subscribeToShopLeads(shop.id, {
      onNewLead: (newLead) => {
        playNotificationChime();
        if (newLead) {
          toast.success(`🎉 New Lead: ${newLead.customer_name} won ${newLead.reward_won}!`);
          setTelemetry((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              total_leads: prev.total_leads + 1,
              pending_count: newLead.status === 'pending' ? prev.pending_count + 1 : prev.pending_count,
              unscratched_count: newLead.status === 'unscratched' ? prev.unscratched_count + 1 : prev.unscratched_count,
              leads_this_week: prev.leads_this_week + 1,
              recent_leads: [newLead, ...prev.recent_leads.filter((l) => l.id !== newLead.id)].slice(0, 7),
            };
          });
        } else {
          toast.success('🎉 New campaign participant joined!');
          fetchTelemetry();
        }

        // Fan-out to registered sub-page listeners (e.g. leads page table)
        leadListenersRef.current.forEach((cb) => cb.onNewLead?.(newLead));
      },
      onStatusUpdated: (leadId, status) => {
        setTelemetry((prev) => {
          if (!prev) return null;
          const wasClaimed = status === 'claimed';
          return {
            ...prev,
            claimed_count: wasClaimed ? prev.claimed_count + 1 : Math.max(0, prev.claimed_count - 1),
            pending_count: wasClaimed ? Math.max(0, prev.pending_count - 1) : prev.pending_count + 1,
            recent_leads: prev.recent_leads.map((l) =>
              l.id === leadId ? { ...l, status: status as any } : l
            ),
          };
        });

        // Fan-out to registered sub-page listeners
        leadListenersRef.current.forEach((cb) => cb.onStatusUpdated?.(leadId, status));
      },
    });

    return () => {
      unsubscribe();
    };
  }, [shop?.id, fetchTelemetry]);

  return (
    <MerchantDataContext.Provider
      value={{
        campaigns,
        allRewards,
        shopPrizes,
        currentPlan,
        campaignsLimit,
        leadsLimit,
        selectedCampaignId,
        setSelectedCampaignId,
        telemetry,
        isLoading,
        isInitialLoaded,
        refreshCampaigns: fetchCampaigns,
        refreshPrizes: fetchShopPrizes,
        refreshTelemetry: fetchTelemetry,
        refreshAll,
        setCampaigns,
        setTelemetry,
        registerLeadListener,
      }}
    >
      {children}
    </MerchantDataContext.Provider>
  );
};

export function useMerchantData() {
  const context = useContext(MerchantDataContext);
  if (!context) {
    throw new Error('useMerchantData must be used within a MerchantDataProvider');
  }
  return context;
}
