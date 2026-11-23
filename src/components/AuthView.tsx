import React, { useState } from 'react';
import { BarChart3, Lock, ScanBarcode, ShieldCheck, TrendingUp } from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { PublicUser, SampleStats } from '../types';

interface AuthViewProps {
  needsAdminSetup: boolean;
  branches: string[];
  sampleStats: SampleStats | null;
  onAuthenticated: (user: PublicUser) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

type AuthMode = 'claim' | 'login' | 'register' | 'forgot';

export const AuthView: React.FC<AuthViewProps> = ({
  needsAdminSetup,
  branches,
  sampleStats,
  onAuthenticated,
  isDark,
  onToggleTheme,
}) => {
  const [mode, setMode] = useState<AuthMode>(needsAdminSetup ? 'claim' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState(branches[0] || 'Flagship Downtown');
  const [resetCode, setResetCode] = useState('');
  const [previewResetCode, setPreviewResetCode] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === 'claim') {
        const res = await apiRequest<{ token: string; user: PublicUser }>('/api/auth/claim-admin', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, branch }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else if (mode === 'login') {
        const res = await apiRequest<{ token: string; user: PublicUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else if (mode === 'register') {
        const res = await apiRequest<{ token: string; user: PublicUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, branch }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else if (mode === 'forgot') {
        if (resetStep === 'request') {
          const res = await apiRequest<{ message: string; previewCode?: string }>(
            '/api/auth/request-reset',
            {
              method: 'POST',
              body: JSON.stringify({ email }),
            }
          );
          setPreviewResetCode(res.previewCode ?? null);
          setResetStep('verify');
          setNotice(res.message);
        } else {
          const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, code: resetCode, newPassword: password }),
          });
          setNotice(res.message);
          setMode('login');
          setResetStep('request');
          setPassword('');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0D0819] text-[#1E113A] dark:text-[#F5F3FF]">
      {/* Minimal 3-Zone Top Bar */}
      <header className="w-full border-b border-[#E9E2FA] dark:border-[#2A1F47] bg-white/80 dark:bg-[#160F29]/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-[#3B0764] dark:text-[#F5F3FF] whitespace-nowrap shrink-0">
            Smart Retail AI
          </span>
          <span className="hidden md:inline text-sm text-[#5B4B7A] dark:text-[#A799C9] whitespace-nowrap">
            Intelligent Retail Management · ML Forecasting · BI Analytics
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-white dark:bg-[#1E1438] text-[#1E113A] dark:text-[#F5F3FF] hover:bg-[#F3EEFF] dark:hover:bg-[#2A1F47] transition-colors whitespace-nowrap shrink-0"
          >
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        {/* Left: Purple Enterprise Value Panel */}
        <section className="lg:col-span-6 rounded-2xl bg-[#2E1065] text-white p-8 lg:p-10 flex flex-col justify-between border border-[#4C1D95]">
          <div className="space-y-6">
            <p className="text-xs font-medium tracking-wide text-[#DDD6FE]">
              Enterprise Retail Suite · Multi-Branch Ready
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight text-balance">
              AI-powered inventory, point of sale, and demand intelligence.
            </h1>
            <p className="text-sm leading-relaxed text-[#E9D5FF]">
              Built for modern retail teams to unify barcode checkout, automated stock replenishment,
              time-series revenue forecasting, and interactive Power BI-style reporting.
            </p>

            <div className="pt-4 space-y-4 border-t border-white/15">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-[#A78BFA] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold">7 / 30 / 90-Day ML Sales Forecasting</h2>
                  <p className="text-xs text-[#DDD6FE]">
                    Seasonal trend decomposition with real holdout MAE, RMSE, and MAPE accuracy metrics.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ScanBarcode className="w-5 h-5 text-[#34D399] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold">Live POS & Barcode Stock Tracking</h2>
                  <p className="text-xs text-[#DDD6FE]">
                    Instant camera or barcode lookup, automated stock deduction, and low-stock alerts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-[#C4B5FD] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold">Customer Segmentation & BI Hub</h2>
                  <p className="text-xs text-[#DDD6FE]">
                    K-Means RFM clustering with Silhouette scoring and Market Basket cross-sell Lift.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-white/15 space-y-2 text-xs text-[#DDD6FE]">
            <div className="flex items-center justify-between">
              <span>Role-Based Access Control</span>
              <span>90-Day Seeded Retail Dataset</span>
            </div>
            {sampleStats && (
              <div className="font-mono tabular-nums text-[#E9D5FF]">
                Pre-loaded: {sampleStats.products} Products · {sampleStats.customers} Customers ·{' '}
                {sampleStats.sales} Sales · {sampleStats.purchases} Purchase Orders
              </div>
            )}
          </div>
        </section>

        {/* Right: Authentication Card */}
        <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-6 flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F3EEFF] dark:bg-[#22173D]">
            {needsAdminSetup && (
              <button
                type="button"
                onClick={() => {
                  setMode('claim');
                  setError(null);
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'claim'
                    ? 'bg-[#6D28D9] text-white'
                    : 'text-[#5B4B7A] dark:text-[#A799C9] hover:text-[#1E113A] dark:hover:text-white'
                }`}
              >
                Setup Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9] hover:text-[#1E113A] dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9] hover:text-[#1E113A] dark:hover:text-white'
              }`}
            >
              Register Staff
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setResetStep('request');
                setError(null);
              }}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'forgot'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9] hover:text-[#1E113A] dark:hover:text-white'
              }`}
            >
              Reset Password
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
              {mode === 'claim' && 'Claim First Administrator Account'}
              {mode === 'login' && 'Sign in to Smart Retail AI'}
              {mode === 'register' && 'Create Staff Operator Account'}
              {mode === 'forgot' && 'Recover Account Access'}
            </h2>
            <p className="mt-1 text-sm text-[#5B4B7A] dark:text-[#A799C9]">
              {mode === 'claim' &&
                'Initialize your workspace with an Admin account. Passwords are hashed securely on the server.'}
              {mode === 'login' && 'Enter your credentials to access POS, inventory, and AI analytics.'}
              {mode === 'register' && 'New accounts are provisioned with Staff permissions by default.'}
              {mode === 'forgot' && 'Generate a one-time verification code to set a new password.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              {notice}
              {previewResetCode && (
                <div className="mt-1 font-mono font-semibold">
                  Sandbox Verification Code: {previewResetCode}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === 'claim' || mode === 'register') && (
              <div>
                <label className="block text-xs font-medium text-[#5B4B7A] dark:text-[#A799C9] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#5B4B7A] dark:text-[#A799C9] mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@smartretail.local"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>

            {mode === 'forgot' && resetStep === 'verify' && (
              <div>
                <label className="block text-xs font-medium text-[#5B4B7A] dark:text-[#A799C9] mb-1.5">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
            )}

            {(mode !== 'forgot' || resetStep === 'verify') && (
              <div>
                <label className="block text-xs font-medium text-[#5B4B7A] dark:text-[#A799C9] mb-1.5">
                  {mode === 'forgot' ? 'New Password (min 6 chars)' : 'Password (min 6 chars)'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
            )}

            {(mode === 'claim' || mode === 'register') && (
              <div>
                <label className="block text-xs font-medium text-[#5B4B7A] dark:text-[#A799C9] mb-1.5">
                  Assigned Store Branch
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {mode === 'claim' ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {loading
                ? 'Processing...'
                : mode === 'claim'
                  ? 'Initialize Admin Workspace'
                  : mode === 'login'
                    ? 'Sign In'
                    : mode === 'register'
                      ? 'Create Staff Account'
                      : resetStep === 'request'
                        ? 'Send Verification Code'
                        : 'Update Password'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};
