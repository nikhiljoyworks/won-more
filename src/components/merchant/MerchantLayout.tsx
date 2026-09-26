import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sparkles, 
  Users, 
  CreditCard, 
  LogOut, 
  ExternalLink, 
  Copy, 
  Check, 
  MessageCircle,
  Store,
  Gift
} from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { formatDate } from '../../lib/utils';
import { buildCampaignUrl, getNavigableCampaignUrl } from '../../lib/domain';

interface MerchantLayoutProps {
  children: React.ReactNode;
  activeCampaignSlug?: string;
}

export const MerchantLayout: React.FC<MerchantLayoutProps> = ({ children }) => {
  const { shop, logout } = useMerchantAuth();
  const navigate = useNavigate();

  if (!shop) {
    navigate('/merchant-login');
    return null;
  }

  const navItems = [
    { label: 'Dashboard', path: '/merchant/dashboard', icon: LayoutDashboard },
    { label: 'Campaigns', path: '/merchant/campaigns', icon: Sparkles },
    { label: 'Prize Pool & Queue', path: '/merchant/prizepool', icon: Gift },
    { label: 'Leads & Winners', path: '/merchant/leads', icon: Users },
    { label: 'Subscription', path: '/merchant/subscription', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen flex bg-surface-bg text-slate-800">
      {/* Left Sidebar - Dark Teal (#0F4C5C) - Sticky */}
      <aside className="w-64 bg-teal-brand text-slate-200 flex flex-col shrink-0 shadow-xl border-r border-teal-dark sticky top-0 h-screen overflow-y-auto">
        {/* Brand Header */}
        <div className="p-6 border-b border-teal-light/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral-brand flex items-center justify-center text-white shadow-lg shadow-coral-brand/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-xl tracking-tight leading-none">Won More</h1>
            <span className="text-xs text-teal-200/70 font-medium">B2B2C Merchant Portal</span>
          </div>
        </div>

        {/* Shop Indicator */}
        <div className="px-6 py-4 bg-teal-dark/50 flex items-center gap-3 border-b border-teal-light/10">
          <Store className="w-4 h-4 text-coral-brand" />
          <div className="truncate">
            <p className="text-sm font-semibold text-white truncate">{shop.shop_name}</p>
            <p className="text-xs text-teal-200/60 truncate font-mono">@{shop.slug}</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold shadow-inner shadow-black/10 translate-x-1'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5 text-coral-brand/90" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Plan Details & Support directly under last menu item */}
        <div className="px-4 pb-6 space-y-3">
          <div className="p-4 rounded-xl bg-teal-dark/70 border border-teal-light/20 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-teal-200/70 font-medium">Current Plan</span>
              <span className="capitalize px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {shop.plan_tier}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Status:</span>
              <span className="font-semibold text-emerald-400 capitalize">{shop.plan_status}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Expires:</span>
              <span className="font-medium text-white">{formatDate(shop.subscription_expires_at)}</span>
            </div>
            
            <a
              href={`https://wa.me/919876543210?text=Hello%20Won%20More%20Support!%20I%20am%20${encodeURIComponent(shop.shop_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Support
            </a>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/merchant-login');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Welcome back, <span className="text-teal-brand">{shop.shop_name}</span>! 👋
            </h2>
            <p className="text-xs text-slate-500">Live store engagement & scratch campaign telemetry</p>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
