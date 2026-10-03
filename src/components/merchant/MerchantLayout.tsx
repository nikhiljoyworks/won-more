import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sparkles, 
  Users, 
  CreditCard, 
  LogOut, 
  MessageCircle,
  Store,
  Gift,
  Menu,
  X
} from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { formatDate } from '../../lib/utils';

interface MerchantLayoutProps {
  children?: React.ReactNode;
  activeCampaignSlug?: string;
}

export const MerchantLayout: React.FC<MerchantLayoutProps> = ({ children }) => {
  const { shop, logout } = useMerchantAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const renderSidebarContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand Header */}
        <div className="p-5 sm:p-6 border-b border-teal-light/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-coral-brand flex items-center justify-center text-white shadow-lg shadow-coral-brand/30 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-white text-xl tracking-tight leading-none">Won More</h1>
              <span className="text-xs text-teal-200/70 font-medium">Merchant Portal</span>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Shop Indicator */}
        <div className="px-5 sm:px-6 py-3.5 bg-teal-dark/50 flex items-center gap-3 border-b border-teal-light/10">
          <Store className="w-4 h-4 text-coral-brand shrink-0" />
          <div className="truncate">
            <p className="text-sm font-semibold text-white truncate">{shop.shop_name}</p>
            <p className="text-xs text-teal-200/60 truncate font-mono">@{shop.slug}</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 sm:p-4 space-y-1.5 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (isMobile) setIsMobileMenuOpen(false);
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold shadow-inner shadow-black/10 translate-x-1'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5 text-coral-brand/90 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Plan Details & Support directly under last menu item */}
      <div className="px-3 sm:px-4 pb-6 space-y-3">
        <div className="p-4 rounded-xl bg-teal-dark/70 border border-teal-light/20 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-teal-200/70 font-medium">Current Plan</span>
            <span className="capitalize px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {shop.plan_tier}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Status:</span>
            <span className={`font-semibold capitalize ${
              shop.plan_status === 'active'
                ? 'text-emerald-400'
                : shop.plan_status === 'paused'
                ? 'text-amber-400'
                : shop.plan_status === 'pending'
                ? 'text-blue-400'
                : 'text-red-400'
            }`}>
              {shop.plan_status}
            </span>
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
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
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
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-surface-bg text-slate-800">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden animate-fadeIn"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer (Slide-out) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-teal-brand text-slate-200 flex flex-col shadow-2xl border-r border-teal-dark md:hidden overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-teal-brand text-slate-200 shrink-0 shadow-xl border-r border-teal-dark sticky top-0 h-screen overflow-y-auto">
        {renderSidebarContent(false)}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 md:px-8 py-3.5 flex items-center justify-between gap-3 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden transition shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="truncate">
              <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                Welcome, <span className="text-teal-brand">{shop.shop_name}</span>! 👋
              </h2>
              <p className="text-[11px] text-slate-500 hidden sm:block">Live store engagement & scratch campaign telemetry</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 capitalize">
              {shop.plan_tier} Tier
            </span>
            <button
              onClick={() => {
                logout();
                navigate('/merchant-login');
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition md:hidden"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
