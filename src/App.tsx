import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MerchantAuthProvider, useMerchantAuth } from './context/MerchantAuthContext';
import { ToastProvider } from './context/ToastContext';
import { LandingPage } from './pages/LandingPage';
import { MerchantLogin } from './pages/merchant/MerchantLogin';
import { MerchantDashboard } from './pages/merchant/MerchantDashboard';
import { MerchantCampaigns } from './pages/merchant/MerchantCampaigns';
import { MerchantPrizePool } from './pages/merchant/MerchantPrizePool';
import { MerchantLeads } from './pages/merchant/MerchantLeads';
import { MerchantSubscription } from './pages/merchant/MerchantSubscription';
import { AdminPortal } from './pages/admin/AdminPortal';
import { CustomerPlay } from './pages/customer/CustomerPlay';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { getSubdomainInfo } from './lib/domain';

// Route guard for merchant portal
const ProtectedMerchantRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shop, isLoading } = useMerchantAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg text-slate-500">
        <div className="w-6 h-6 border-2 border-teal-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shop) {
    return <Navigate to="/merchant-login" replace />;
  }

  return <>{children}</>;
};

// Root Page Selector: if loaded on a shop subdomain (e.g. urban-roast.wonmore.com), render CustomerPlay
const RootComponent: React.FC = () => {
  const subInfo = getSubdomainInfo();
  if (subInfo.isSubdomain && subInfo.shopSlug) {
    return <CustomerPlay />;
  }
  return <LandingPage />;
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <MerchantAuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Root route: Landing page OR customer app if subdomain detected */}
          <Route path="/" element={<RootComponent />} />

          {/* Super Admin God Mode */}
          <Route path="/admin-portal" element={<AdminPortal />} />

          {/* Merchant Authentication */}
          <Route path="/merchant-login" element={<MerchantLogin />} />

          {/* Merchant Portal Protected Routes */}
          <Route
            path="/merchant/dashboard"
            element={
              <ProtectedMerchantRoute>
                <MerchantDashboard />
              </ProtectedMerchantRoute>
            }
          />
          <Route
            path="/merchant/campaigns"
            element={
              <ProtectedMerchantRoute>
                <MerchantCampaigns />
              </ProtectedMerchantRoute>
            }
          />
          <Route
            path="/merchant/prizepool"
            element={
              <ProtectedMerchantRoute>
                <MerchantPrizePool />
              </ProtectedMerchantRoute>
            }
          />
          <Route
            path="/merchant/leads"
            element={
              <ProtectedMerchantRoute>
                <MerchantLeads />
              </ProtectedMerchantRoute>
            }
          />
          <Route
            path="/merchant/subscription"
            element={
              <ProtectedMerchantRoute>
                <MerchantSubscription />
              </ProtectedMerchantRoute>
            }
          />
          <Route path="/merchant" element={<Navigate to="/merchant/dashboard" replace />} />

          {/* Public Legal Pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />

          {/* Customer Play Routes (Supports direct ID, prefixed /c/, or vanity /:shopSlug/:campaignSlug) */}
          <Route path="/play/:campaignId" element={<CustomerPlay />} />
          <Route path="/c/:shopSlug/:campaignSlug" element={<CustomerPlay />} />
          
          {/* Branded Vanity Customer Path e.g. /urban-roast/grand-opening */}
          <Route path="/:shopSlug/:campaignSlug" element={<CustomerPlay />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MerchantAuthProvider>
  </ToastProvider>
  );
};

export default App;
