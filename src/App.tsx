import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MerchantAuthProvider, useMerchantAuth } from './context/MerchantAuthContext';
import { ToastProvider } from './context/ToastContext';
import { CustomerPlay } from './pages/customer/CustomerPlay';
import { getSubdomainInfo } from './lib/domain';

// Lazy-load merchant & admin administration pages to shrink public customer bundle
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const MerchantLogin = lazy(() => import('./pages/merchant/MerchantLogin').then(m => ({ default: m.MerchantLogin })));
const MerchantDashboard = lazy(() => import('./pages/merchant/MerchantDashboard').then(m => ({ default: m.MerchantDashboard })));
const MerchantCampaigns = lazy(() => import('./pages/merchant/MerchantCampaigns').then(m => ({ default: m.MerchantCampaigns })));
const MerchantPrizePool = lazy(() => import('./pages/merchant/MerchantPrizePool').then(m => ({ default: m.MerchantPrizePool })));
const MerchantLeads = lazy(() => import('./pages/merchant/MerchantLeads').then(m => ({ default: m.MerchantLeads })));
const MerchantSubscription = lazy(() => import('./pages/merchant/MerchantSubscription').then(m => ({ default: m.MerchantSubscription })));
const AdminPortal = lazy(() => import('./pages/admin/AdminPortal').then(m => ({ default: m.AdminPortal })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
    <div className="w-7 h-7 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Route guard for merchant portal
const ProtectedMerchantRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shop, isLoading } = useMerchantAuth();

  if (isLoading) {
    return <PageLoader />;
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
          <Suspense fallback={<PageLoader />}>
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
      </Suspense>
      </BrowserRouter>
    </MerchantAuthProvider>
  </ToastProvider>
  );
};

export default App;
