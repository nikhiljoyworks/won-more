import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shop } from '../types';
import { loginMerchantRpc, verifyMerchantSessionRpc, logoutMerchantRpc } from '../lib/supabase';
import { getClientIp } from '../lib/rateLimit';

interface MerchantAuthContextType {
  shop: Shop | null;
  sessionToken: string | null;
  isLoading: boolean;
  login: (email: string, pin: string) => Promise<{
    success: boolean;
    error?: string;
    email_not_found?: boolean;
    is_blocked?: boolean;
    remaining_seconds?: number;
  }>;
  logout: () => void;
  refreshShop: () => Promise<void>;
}

const MerchantAuthContext = createContext<MerchantAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'won_more_merchant_session_token';
const LEGACY_STORAGE_KEY = 'won_more_merchant_shop_id';

export const MerchantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifySession = async (token: string) => {
    try {
      const res = await verifyMerchantSessionRpc(token);
      if (res.valid && res.shop) {
        setShop(res.shop);
        setSessionToken(token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setShop(null);
        setSessionToken(null);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setShop(null);
      setSessionToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Clear insecure legacy key if present
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      verifySession(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (
    email: string,
    pin: string
  ): Promise<{
    success: boolean;
    error?: string;
    email_not_found?: boolean;
    is_blocked?: boolean;
    remaining_seconds?: number;
  }> => {
    try {
      const clientIp = await getClientIp();
      const res = await loginMerchantRpc(email, pin, clientIp);

      if (!res.success || !res.token || !res.shop) {
        return {
          success: false,
          error: res.error || 'Invalid email or PIN. Please check your credentials.',
          email_not_found: res.email_not_found,
          is_blocked: res.is_blocked,
          remaining_seconds: res.remaining_seconds,
        };
      }

      const shopData = res.shop;

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

      localStorage.setItem(TOKEN_KEY, res.token);
      setSessionToken(res.token);
      setShop(shopData);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    if (sessionToken) {
      logoutMerchantRpc(sessionToken);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setShop(null);
    setSessionToken(null);
  };

  const refreshShop = async () => {
    if (sessionToken) {
      await verifySession(sessionToken);
    }
  };

  return (
    <MerchantAuthContext.Provider value={{ shop, sessionToken, isLoading, login, logout, refreshShop }}>
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
