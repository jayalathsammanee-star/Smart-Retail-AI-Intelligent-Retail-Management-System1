import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BrainCircuit,
  Layers,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Package,
  ScanBarcode,
  Smartphone,
  Sun,
} from 'lucide-react';
import { AuthView } from './components/AuthView';
import { BiAnalyticsView } from './components/BiAnalyticsView';
import { CustomersAlertsView } from './components/CustomersAlertsView';
import { DashboardView } from './components/DashboardView';
import { MlStudioView } from './components/MlStudioView';
import { PosScannerView } from './components/PosScannerView';
import { ProductsInventoryView } from './components/ProductsInventoryView';
import { SystemBlueprintView } from './components/SystemBlueprintView';
import { apiRequest, setAuthToken } from './lib/api';
import type { AppSection, NotificationRecord, PublicUser, SampleStats } from './types';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [branches, setBranches] = useState<string[]>([
    'Flagship Downtown',
    'Westside Mall',
    'Northside Hub',
  ]);
  const [sampleStats, setSampleStats] = useState<SampleStats | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [section, setSection] = useState<AppSection>('dashboard');
  const [isDark, setIsDark] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    apiRequest<{ needsAdminSetup: boolean; branches: string[]; sampleStats?: SampleStats }>(
      '/api/auth/bootstrap-status'
    )
      .then((res) => {
        setNeedsAdminSetup(res.needsAdminSetup);
        if (Array.isArray(res.branches) && res.branches.length > 0) {
          setBranches(res.branches);
        }
        if (res.sampleStats) {
          setSampleStats(res.sampleStats);
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  const refreshUnreadCount = () => {
    apiRequest<{ notifications: NotificationRecord[] }>('/api/notifications')
      .then((res) => {
        setUnreadCount(res.notifications.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (user) {
      refreshUnreadCount();
    }
  }, [user, refreshSignal]);

  const handleAuthenticated = (authedUser: PublicUser) => {
    setUser(authedUser);
    setNeedsAdminSetup(false);
    setSection('dashboard');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    apiRequest<{ needsAdminSetup: boolean }>('/api/auth/bootstrap-status')
      .then((res) => setNeedsAdminSetup(res.needsAdminSetup))
      .catch(() => {});
  };

  const triggerDataRefresh = () => {
    setRefreshSignal((s) => s + 1);
  };

  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#2E1065] text-white p-6">
        <div className="w-12 h-12 rounded-xl bg-[#7C3AED] flex items-center justify-center font-bold text-lg mb-4">
          SR
        </div>
        <h1 className="text-xl font-bold tracking-tight">Smart Retail AI</h1>
        <p className="mt-1 text-xs text-[#DDD6FE]">Initializing Intelligent Retail Workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView
        needsAdminSetup={needsAdminSetup}
        branches={branches}
        sampleStats={sampleStats}
        onAuthenticated={handleAuthenticated}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      />
    );
  }

  const navItems: Array<{ id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS & Scan', icon: ScanBarcode },
    { id: 'inventory', label: 'Products & Stock', icon: Package },
    { id: 'ml', label: 'AI & ML Studio', icon: BrainCircuit },
    { id: 'bi', label: 'BI Analytics', icon: BarChart3 },
    { id: 'customers', label: 'CRM & Alerts', icon: Bell },
    { id: 'architecture', label: 'System Blueprint', icon: Layers },
  ];

  const activeNav = navItems.find((n) => n.id === section);

  return (
    <div className="min-h-screen flex bg-[#F7F5FF] dark:bg-[#0D0819] text-[#1E113A] dark:text-[#F5F3FF]">
      {/* Desktop Sidebar */}
      {!mobilePreview && (
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#2E1065] text-white border-r border-[#4C1D95]">
          <div>
            <div className="px-6 py-5 border-b border-white/10">
              <div className="text-lg font-bold tracking-tight">Smart Retail AI</div>
              <div className="mt-0.5 text-xs text-[#DDD6FE]">{user.branch}</div>
            </div>

            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
                      active
                        ? 'bg-[#6D28D9] text-white'
                        : 'text-[#DDD6FE] hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 whitespace-nowrap">
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </span>
                    {item.id === 'customers' && unreadCount > 0 && (
                      <span className="font-mono text-xs bg-[#10B981] text-[#052E16] font-semibold px-1.5 py-0.5 rounded-md tabular-nums">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-bold shrink-0">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-[#DDD6FE] capitalize">{user.role} Account</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#EDE9FE] bg-white/10 hover:bg-white/15 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Contextual Top Bar */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#160F29]/90 backdrop-blur-sm border-b border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-[#3B0764] dark:text-[#F5F3FF] lg:hidden whitespace-nowrap">
                Smart Retail AI
              </span>
              <span className="text-[#5B4B7A] dark:text-[#A799C9] hidden sm:inline">
                Smart Retail AI
              </span>
              <span className="text-[#5B4B7A] dark:text-[#A799C9] hidden sm:inline">/</span>
              <span className="font-semibold truncate">{activeNav?.label}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobilePreview((m) => !m)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#F3EEFF] dark:hover:bg-[#22173D] whitespace-nowrap"
                title="Toggle Mobile App Frame Preview"
              >
                {mobilePreview ? (
                  <>
                    <Monitor className="w-3.5 h-3.5 text-[#6D28D9]" />
                    Desktop Console
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-[#6D28D9]" />
                    Mobile Preview
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                className="p-2 rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#F3EEFF] dark:hover:bg-[#22173D]"
                aria-label="Toggle light or dark mode"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#4C1D95]" />}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="lg:hidden px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Viewport Container (Supports Optional Mobile Frame Preview) */}
        <main
          className={`flex-1 ${
            mobilePreview
              ? 'py-6 px-4 flex justify-center bg-[#EFEAFF] dark:bg-[#090512]'
              : 'p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto'
          }`}
        >
          <div
            className={
              mobilePreview
                ? 'w-[412px] max-w-full rounded-3xl border-4 border-[#3B0764] bg-[#F7F5FF] dark:bg-[#0D0819] p-4 pb-20 overflow-y-auto max-h-[820px] relative'
                : 'w-full'
            }
          >
            {section === 'dashboard' && (
              <DashboardView
                branches={branches}
                onNavigate={setSection}
                refreshSignal={refreshSignal}
                onDataMutated={triggerDataRefresh}
              />
            )}
            {section === 'pos' && (
              <PosScannerView branches={branches} onSaleCompleted={triggerDataRefresh} />
            )}
            {section === 'inventory' && (
              <ProductsInventoryView
                userRole={user.role}
                branches={branches}
                onInventoryMutated={triggerDataRefresh}
              />
            )}
            {section === 'ml' && <MlStudioView onInventoryMutated={triggerDataRefresh} />}
            {section === 'bi' && <BiAnalyticsView branches={branches} />}
            {section === 'customers' && (
              <CustomersAlertsView
                currentUser={user}
                branches={branches}
                onProfileUpdated={setUser}
                onNotificationsChanged={refreshUnreadCount}
              />
            )}
            {section === 'architecture' && <SystemBlueprintView />}

            {/* Mobile Preview Bottom Nav */}
            {mobilePreview && (
              <nav className="sticky bottom-0 left-0 right-0 mt-4 bg-white dark:bg-[#160F29] border-t border-[#E9E2FA] dark:border-[#2A1F47] px-2 py-2 flex items-center justify-around rounded-b-2xl">
                {navItems.slice(0, 5).map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`p-2 rounded-lg flex flex-col items-center gap-0.5 text-[10px] ${
                        active ? 'text-[#6D28D9] dark:text-[#A78BFA] font-semibold' : 'text-[#5B4B7A] dark:text-[#A799C9]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </main>

        {/* Responsive Mobile Bottom Navigation */}
        {!mobilePreview && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#160F29] border-t border-[#E9E2FA] dark:border-[#2A1F47] px-2 py-1.5 flex items-center justify-around">
            {navItems.slice(0, 6).map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`px-2 py-1 rounded-md flex flex-col items-center gap-0.5 text-[10px] ${
                    active ? 'text-[#6D28D9] dark:text-[#A78BFA] font-semibold' : 'text-[#5B4B7A] dark:text-[#A799C9]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
