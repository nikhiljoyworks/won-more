import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shop } from '../types';
import { supabase } from '../lib/supabase';

interface MerchantAuthContextType {
  shop: Shop | null;
  isLoading: boolean;
  login: (email: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshShop: () => Promise<void>;
}

const MerchantAuthContext = createContext<MerchantAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'won_more_merchant_shop_id';

export const MerchantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShopById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        localStorage.removeItem(STORAGE_KEY);
        setShop(null);
      } else {
        setShop(data as Shop);
      }
    } catch {
      setShop(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedShopId = localStorage.getItem(STORAGE_KEY);
    if (savedShopId) {
      fetchShopById(savedShopId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password_pin', pin.trim())
        .single();

      if (error || !data) {
        return { success: false, error: 'Invalid email or PIN. Please check your credentials.' };
      }

      const shopData = data as Shop;

      if (shopData.plan_status === 'pending') {
        return {
          success: false,
          error: 'Your account is pending WhatsApp payment confirmation. Once payment is verified, the admin will activate your access.',
        };
      }

      if (shopData.plan_status === 'suspended') {
        return {
          success: false,
          error: 'Your subscription is suspended. Please contact Won More support via WhatsApp to reactivate.',
        };
      }

      // Check expiration
      if (shopData.subscription_expires_at) {
        const expires = new Date(shopData.subscription_expires_at).getTime();
        if (expires < Date.now()) {
          return {
            success: false,
            error: 'Your subscription has expired. Please renew your plan via WhatsApp to access the dashboard.',
          };
        }
      }

      localStorage.setItem(STORAGE_KEY, shopData.id);
      setShop(shopData);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShop(null);
  };

  const refreshShop = async () => {
    if (shop?.id) {
      await fetchShopById(shop.id);
    }
  };

  return (
    <MerchantAuthContext.Provider value={{ shop, isLoading, login, logout, refreshShop }}>
      {children}
    </MerchantAuthContext.Provider>
  );
};

export function useMerchantAuth() {
  const context = useContext(MerchantAuthContext);
  if (!context) {
    throw new Error('useMerchantAuth must be used within a MerchantAuthProvider');
  }
  return context;
}
